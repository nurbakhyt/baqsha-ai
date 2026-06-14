"use client";

import { useEffect, useState, useMemo } from "react";
import { useCopilotAction, useCopilotReadable, useCopilotAdditionalInstructions } from "@copilotkit/react-core";
import { useStore } from "@/lib/hooks/useStore";
import { apiFetch } from "@/lib/api";

interface CatalogProduct {
  id: string;
  name: string;
  nameEn?: string;
  nameRu?: string;
  priceMinor: number;
  unit: string;
  package: string;
  stock: number;
}

const UNIT_LABEL: Record<string, string> = {
  kg: "кг",
  piece: "шт",
  pack: "уп",
  liter: "л",
};

const CYRILLICNormalize: Record<string, string> = {
  "ә": "а", "ғ": "г", "қ": "к", "ң": "н", "ө": "о", "ұ": "у", "ү": "у", "і": "и",
  "Ә": "А", "Ғ": "Г", "Қ": "К", "Ң": "Н", "Ө": "О", "Ұ": "У", "Ү": "У", "І": "И",
};

function normalize(str: string): string {
  return str
    .toLowerCase()
    .split("")
    .map((ch) => CYRILLICNormalize[ch] || ch)
    .join("");
}

function findProduct(products: CatalogProduct[], query: string): CatalogProduct | undefined {
  const q = normalize(query);
  return products.find(
    (p) =>
      normalize(p.name).includes(q) ||
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.nameEn?.toLowerCase().includes(query.toLowerCase()) ||
      p.nameRu?.toLowerCase().includes(query.toLowerCase())
  );
}

function buildCatalogText(products: CatalogProduct[]): string {
  const inStock = products.filter((p) => p.stock > 0);
  const fruits = inStock.filter((p) => ["Лимон", "Апельсин", "Мандарин", "Банан", "Ананас", "Манго", "Алма", "Алмұрт", "Жүзім", "Құлпынай", "Қарақат"].includes(p.name));
  const veggies = inStock.filter((p) => !fruits.includes(p));

  const fmt = (p: CatalogProduct) => {
    const ru = p.nameRu;
    return `- ${p.name}${ru ? ` (${ru})` : ""}${p.nameEn ? ` [${p.nameEn}]` : ""} — ${p.priceMinor / 100}₸/${UNIT_LABEL[p.unit] || p.unit}`;
  };

  const lines: string[] = [];
  if (fruits.length) lines.push("Фрукты:\n" + fruits.map(fmt).join("\n"));
  if (veggies.length) lines.push("Овощи:\n" + veggies.map(fmt).join("\n"));
  return lines.join("\n\n");
}

function buildUnitsText(products: CatalogProduct[]): string {
  const inStock = products.filter((p) => p.stock > 0);
  const kg = inStock.filter((p) => p.unit === "kg").map((p) => p.name);
  const piece = inStock.filter((p) => p.unit === "piece").map((p) => p.name);
  const parts: string[] = [];
  if (kg.length) parts.push(kg.join(", ") + " — продаются по кг");
  if (piece.length) parts.push(piece.join(", ") + " — продаются поштучно");
  return parts.join("\n");
}

const BASE_INSTRUCTIONS = `Ты — БакшаАИ, дружелюбный помощник магазина свежих фруктов и овощей Baqsha.AI с доставкой на дом в Казахстане.

## Язык
Понимай русский и казахский. Отвечай на языке пользователя. Если пользователь пишет на казахском — отвечай на казахском. Если на русском — на русском.

## Приветствие
При первом обращении поздоровайся и коротко представься. При повторных — сразу переходи к делу.

## Доступные инструменты и когда их использовать

### addToCart(productName, quantity) — ОБЯЗАТЕЛЬНО вызывай этот инструмент когда пользователь хочет ДОБАВИТЬ товар в корзину.
- Один вызов на каждый товар (если "лимон и банан" — два вызова)
- quantity по умолчанию 1 если не указано
- Если пользователь говорит "килограмм/кilo/кг" — quantity = число перед единицей (например "2 кило банан" → quantity=2)
- Если без единицы — quantity=1
- Не пиши "я добавлю" — сразу вызывай инструмент!

### removeFromCart(productId, productName, quantity)
Вызывай когда пользователь хочет УБРАТЬ или УМЕНЬШИТЬ количество товара.
- "убери банан" → quantity=1, найти productId из корзины
- "убери всё" → quantity = текущее количество товара
- Найди productId в данных корзины (readable context)

### showCart
Вызывай когда пользователь просит ПОКАЗАТЬ корзину, спрашивает "что в корзине", "сколько итого", "покажи заказ".

### clearCart
Вызывай когда пользователь хочет ОЧИСТИТЬ корзину полностью.

## Правила вызова инструментов

ВАЖНО: Когда пользователь просит добавить/убрать товар или показать корзину — ты ОБЯЗАН вызвать соответствующий инструмент, а не просто написать текст. Инструмент выполняет реальное действие.

1. Если пользователь говорит "дай/возьми/хочу/добавь/сал/қос + название товара" → вызови addToCart
2. Если пользователь говорит "убери/удали/шығар + название товара" → вызови removeFromCart
3. Если пользователь спрашивает "что в корзине/сколько итого" → вызови showCart
4. НЕ вызывай addToCart если товара нет в списке каталога — просто скажи что товар не найден
5. НЕ выдумывай цены — ты не знаешь актуальные цены, они в каталоге ниже
6. Если инструмент вернул "не найден" — скажи пользователю и предложи похожие товары
7. Не вызывай инструменты для вопросов-ответов (приветствие, "что умеешь", "как дела")
8. Для removeFromCart и showCart — ты видишь текущую корзину в контексте, используй реальные productId

## Парсинг количества

Примеры парсинга:
- "лимон" → addToCart("лимон", 1)
- "два кило банан" → addToCart("банан", 2)
- "лимон и 2 кило апельсин" → addToCart("лимон", 1) + addToCart("апельсин", 2)
- "екі кило банан және мандарин" → addToCart("банан", 2) + addToCart("мандарин", 1)
- "хочу алмурант" → addToCart("алмұрт", 1) (учти опечатки)
- "кг манго" → addToCart("манго", 1)
- "два ананаса" → addToCart("ананас", 2)

## Что ты умеешь
- Помочь выбрать свежие фрукты и овощи
- Добавить товары в корзину
- Показать корзину и итоговую сумму
- Убрать или изменить количество товаров
- Подсказать что есть в наличии
- Ответить на вопросы о доставке (скажи что доставка осуществляется по Алматы)

## Чего ты НЕ должен делать
- Не придумывай цены — используй только из каталога выше
- Не добавляй товары которых нет в каталоге — предложи alternatives
- Не обсуждай оплату — скажи что оплата при доставке
- Не отвечай на вопросы не связанные с заказом еды — вежливо верни к теме

## Формат ответов
- Будь кратким: 1-3 предложения
- При добавлении товара — СНАЧАЛА вызови addToCart, потом подтверди результат
- При ошибке — объясни что пошло не так и предложи решение
- Используй эмодзи умеренно: 🥬 🍎 🥒 🛒
- НЕ пиши "я добавлю/возьму" перед вызовом инструмента — просто вызывай его!`;

export function CopilotTools() {
  const cart = useStore((s) => s.cart);
  const addToCart = useStore((s) => s.addToCart);
  const removeFromCart = useStore((s) => s.removeFromCart);
  const clearCart = useStore((s) => s.clearCart);

  const [products, setProducts] = useState<CatalogProduct[]>([]);

  useEffect(() => {
    apiFetch("/api/catalog/products")
      .then((d) => setProducts(d.data || []))
      .catch(() => {});
  }, []);

  const catalogText = useMemo(() => buildCatalogText(products), [products]);
  const unitsText = useMemo(() => buildUnitsText(products), [products]);

  const fullInstructions = useMemo(
    () =>
      `${BASE_INSTRUCTIONS}\n\n## Каталог товаров (актуальные цены из базы данных)\n\n${catalogText}\n\n## Единицы измерения\n${unitsText}`,
    [catalogText, unitsText]
  );

  useCopilotAdditionalInstructions({ instructions: fullInstructions });

  useCopilotReadable({
    description: "Текущая корзина пользователя",
    value: cart.map((i) => ({
      productId: i.productId,
      name: i.name,
      quantity: i.quantity,
      price: i.priceMinor,
      total: i.priceMinor * i.quantity,
    })),
  });

  useCopilotAction({
    name: "addToCart",
    description: "Добавить товар в корзину по названию. Цена и ID берутся из каталога автоматически.",
    parameters: [
      { name: "productName", type: "string", description: "Название товара (например 'банан', 'лимон')" },
      { name: "quantity", type: "number", description: "Количество (по умолчанию 1)" },
    ],
    handler: async ({ productName, quantity }: any) => {
      const qty = Number(quantity) || 1;
      const data = await apiFetch(`/api/catalog/products`);
      const product = findProduct(data.data || [], productName);
      if (!product) return `Товар "${productName}" не найден в каталоге`;
      addToCart({
        productId: product.id,
        name: product.name,
        priceMinor: product.priceMinor,
        quantity: qty,
        package: product.package,
        unit: product.unit,
        mediaKeys: (product as any).mediaKeys || [],
      });
      return `Товар "${product.name}" добавлен в корзину (${qty} ${product.unit}, ${product.priceMinor / 100}₸)`;
    },
    render: ({ args, status, result }: any) => {
      if (status === "inProgress" || !result) return <></>;
      const isNotFound = result.includes("не найден");
      return (
        <div className={`p-3 rounded-lg text-sm ${isNotFound ? "bg-yellow-50 text-yellow-800 border border-yellow-200" : "bg-green-50 text-green-800 border border-green-200"}`}>
          {result}
        </div>
      );
    },
    followUp: false,
  }, []);

  useCopilotAction({
    name: "removeFromCart",
    description: "Убрать товар из корзины (уменьшить количество). Если нужно убрать весь товар — quantity = текущее количество.",
    parameters: [
      { name: "productId", type: "string", description: "ID товара" },
      { name: "productName", type: "string", description: "Название товара" },
      { name: "quantity", type: "number", description: "Сколько убрать (по умолчанию 1)" },
    ],
    handler: async ({ productId, productName, quantity }: any) => {
      const removeQty = Number(quantity) || 1;
      const item = cart.find((i) => i.productId === productId);
      if (!item) return `Товар "${productName}" не найден в корзине`;
      const newQty = item.quantity - removeQty;
      if (newQty <= 0) {
        removeFromCart(productId);
        return `Товар "${productName}" удалён из корзины`;
      }
      addToCart({ ...item, quantity: -removeQty });
      return `Товар "${productName}" — осталось ${newQty} ${item.unit}`;
    },
    followUp: false,
  }, [cart]);

  useCopilotAction({
    name: "showCart",
    description: "Показать содержимое корзины",
    handler: async () => {
      if (cart.length === 0) return "Корзина пуста / Себет бос";
      const items = cart.map((i) => `${i.name} × ${i.quantity} = ${i.priceMinor * i.quantity} тиын`).join("\n");
      const total = cart.reduce((s, i) => s + i.priceMinor * i.quantity, 0);
      return `Корзина / Себет:\n${items}\n\nИтого / Барлығы: ${total} тиын (${(total / 100).toFixed(0)}₸)`;
    },
    followUp: false,
  }, [cart]);

  useCopilotAction({
    name: "clearCart",
    description: "Очистить корзину",
    handler: async () => {
      clearCart();
      return "Корзина очищена";
    },
    followUp: false,
  }, []);

  return null;
}
