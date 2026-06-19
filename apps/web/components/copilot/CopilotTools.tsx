"use client";

import { useEffect, useState, useMemo } from "react";
import { useCopilotAction, useCopilotReadable, useCopilotAdditionalInstructions } from "@copilotkit/react-core";
import { useStore } from "@/lib/hooks/useStore";
import { apiFetch } from "@/lib/api";
import { OrderConfirmation } from "./OrderConfirmation";

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

const BASE_INSTRUCTIONS = `Ты — БакшаАИ, дружелюбный помощник магазина свежих фруктов и овощей Baqsha.AI с доставкой на дом в Казахстане (Алматы).

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

### createOrder(deliveryAddress, contactPhone, notes)
Вызывай когда пользователь хочет ОФОРМИТЬ/ЗАКАЗАТЬ/ОПЛАТИТЬ и у него есть товары в корзине.
- СНАЧАЛА убедись что в корзине есть товары (проверь readable context корзины)
- Если корзина пуста — скажи "Сначала добавьте товары в корзину"
- Если товаров нет — попроси назвать адрес доставки и телефон
- Пользователь ДОЛЖЕН указать адрес И телефон перед вызовом
- Если пользователь дал только адрес — спроси телефон
- Если пользователь дал только телефон — спроси адрес
- notes — опционально, если пользователь хочет что-то уточнить (например "подъезд 3, код домофона 1234")
- После успешного создания — поздравь и покажи номер заказа
- Если ошибка (товар закончился, etc.) — объясни и предложи решение

### getOrderStatus(orderId?)
Вызывай когда пользователь спрашивает "Где мой заказ?", "Статус заказа", "Когда доставка?".
- Если пользователь не указал номер — покажи все его заказы
- Если указал номер — покажи конкретный заказ

## Правила вызова инструментов

ВАЖНО: Когда пользователь просит добавить/убрать товар, показать корзину или оформить заказ — ты ОБЯЗАН вызвать соответствующий инструмент, а не просто написать текст. Инструмент выполняет реальное действие.

1. Если пользователь говорит "дай/возьми/хочу/добавь/сал/қос + название товара" → вызови addToCart
2. Если пользователь говорит "убери/удали/шығар + название товара" → вызови removeFromCart
3. Если пользователь спрашивает "что в корзине/сколько итого" → вызови showCart
4. Если пользователь говорит "заказать/оформить/оплатить" → вызови createOrder
5. Если пользователь спрашивает про заказ/доставку → вызови getOrderStatus
6. НЕ вызывай addToCart если товара нет в списке каталога — просто скажи что товар не найден
7. НЕ выдумывай цены — ты не знаешь актуальные цены, они в каталоге ниже
8. Если инструмент вернул "не найден" — скажи пользователю и предложи похожие товары
9. Не вызывай инструменты для вопросов-ответов (приветствие, "что умеешь", "как дела")
10. Для removeFromCart и showCart — ты видишь текущую корзину в контексте, используй реальные productId

## Процесс оформления заказа (createOrder)

Когда пользователь говорит "хочу заказать" или "оформить":
1. Проверь корзину — если пуста, предложи добавить товары
2. Если корзина не пуста — покажи краткую сводку (состав, итого)
3. Спроси адрес доставки
4. Спроси телефон для связи
5. Если пользователь дал всё — спроси "Всё верно? Подтверждаю заказ?"
6. После подтверждения — вызови createOrder с адресом и телефоном
7. Покажи результат — номер заказа, итого, адрес

Парсинг адреса из текста:
- "ул Абая 52" → "ул. Абая, 52"
- "проспект Достык 100" → "пр. Достык, 100"
- "на дома" → не принимай, спроси конкретный адрес

Парсинг телефона:
- Принимай в любом формате: +77001234567, 87001234567, 77001234567, +7 (700) 123-45-67
- Просто передавай как есть инструменту

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
- Оформить заказ с доставкой на дом
- Показать статус заказа
- Подсказать что есть в наличии
- Ответить на вопросы о доставке (доставка по Алматы, оплата при доставке)

## Чего ты НЕ должен делать
- Не придумывай цены — используй только из каталога выше
- Не добавляй товары которых нет в каталоге — предложи alternatives
- Не обсуждай онлайн-оплату — скажи что оплата при доставке наличными
- Не отвечай на вопросы не связанные с заказом еды — вежливо верни к теме
- Не оформляй заказ без адреса и телефона — это обязательно

## Формат ответов
- Будь кратким: 1-3 предложения
- При добавлении товара — СНАЧАЛА вызови addToCart, потом подтверди результат
- При оформлении — собери адрес и телефон, подтверди, потом вызови createOrder
- При ошибке — объясни что пошло не так и предложи решение
- Используй эмодзи умеренно: 🥬 🍎 🥒 🛒
- НЕ пиши "я добавлю/возьму" перед вызовом инструмента — просто вызывай его!`;

export function CopilotTools() {
  const cart = useStore((s) => s.cart);
  const user = useStore((s) => s.user);
  const addToCart = useStore((s) => s.addToCart);
  const updateQuantity = useStore((s) => s.updateQuantity);
  const removeFromCart = useStore((s) => s.removeFromCart);
  const clearCart = useStore((s) => s.clearCart);
  const login = useStore((s) => s.login);

  const [products, setProducts] = useState<CatalogProduct[]>([]);

  useEffect(() => {
    apiFetch("/api/catalog/products")
      .then((d) => setProducts(d.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) return;
    let cancelled = false;
    apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "customer@example.com", password: "customer123" }),
    })
      .then((res) => {
        if (cancelled || !res.success) return;
        login(res.data.user, res.data.session.id);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, login]);

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

  useCopilotReadable({
    description: "Авторизован ли пользователь",
    value: user ? `Пользователь авторизован: ${user.name || user.email} (роль: ${user.role})` : "Пользователь НЕ авторизован. Нужно войти в аккаунт чтобы оформить заказ.",
  });

  useCopilotAction({
    name: "addToCart",
    description: "Добавить товар в корзину по названию. Цена и ID берутся из каталога автоматически.",
    parameters: [
      { name: "productName", type: "string", description: "Название товара (например 'банан', 'лимон')" },
      { name: "quantity", type: "number", description: "Количество (по умолчанию 1)" },
    ],
    handler: async ({ productName, quantity }: any) => {
      try {
        const qty = Number(quantity) || 1;
        const product = findProduct(products, productName);
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
      } catch (err) {
        return `Ошибка при добавлении: ${err instanceof Error ? err.message : "неизвестная ошибка"}`;
      }
    },
    render: ({ args, status, result }: any) => {
      if (status === "inProgress" || !result) return <></>;
      const isError = result.includes("не найден") || result.includes("Ошибка");
      return (
        <div className={`p-3 rounded-lg text-sm ${isError ? "bg-yellow-50 text-yellow-800 border border-yellow-200" : "bg-green-50 text-green-800 border border-green-200"}`}>
          {result}
        </div>
      );
    },
    followUp: false,
  }, [products, addToCart]);

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
      updateQuantity(productId, -removeQty);
      const newQty = item.quantity - removeQty;
      if (newQty <= 0) {
        return `Товар "${productName}" удалён из корзины`;
      }
      return `Товар "${productName}" — осталось ${newQty} ${item.unit}`;
    },
    followUp: false,
  }, [cart, updateQuantity]);

  useCopilotAction({
    name: "showCart",
    description: "Показать содержимое корзины",
    handler: async () => {
      if (cart.length === 0) return "Корзина пуста / Себет бос";
      const items = cart.map((i) => `${i.name} × ${i.quantity} = ${(i.priceMinor * i.quantity) / 100}₸`).join("\n");
      const total = cart.reduce((s, i) => s + i.priceMinor * i.quantity, 0);
      return `Корзина / Себет:\n${items}\n\nИтого / Барлығы: ${total / 100}₸`;
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

  useCopilotAction({
    name: "createOrder",
    description: "Оформить заказ. Вызывай когда пользователь подтвердил заказ и указал адрес и телефон.",
    parameters: [
      { name: "deliveryAddress", type: "string", description: "Полный адрес доставки (город, улица, дом)" },
      { name: "contactPhone", type: "string", description: "Телефон для связи с курьером" },
      { name: "notes", type: "string", description: "Дополнительные заметки (подъезд, код домофона и т.д.)" },
    ],
    handler: async ({ deliveryAddress, contactPhone, notes }: any) => {
      try {
        if (!user) {
          return "Для оформления заказа нужно войти в аккаунт. Пожалуйста, войдите через форму входа.";
        }

        if (cart.length === 0) {
          return "Корзина пуста. Сначала добавьте товары.";
        }

        const idempotencyKey = crypto.randomUUID();

        const result = await apiFetch("/api/orders", {
          method: "POST",
          body: JSON.stringify({
            idempotencyKey,
            items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
            deliveryAddress,
            contactPhone,
            notes: notes || undefined,
          }),
        });

        if (!result.success) {
          if (result.error === "Insufficient stock") {
            const name = result.name || "товар";
            const available = typeof result.available === "number" ? result.available : 0;
            return `К сожалению, "${name}" закончился на складе (в наличии: ${available}). Хотите заменить на другой товар или уменьшить количество?`;
          }
          return `Ошибка при оформлении: ${typeof result.error === 'string' ? result.error : JSON.stringify(result.error)}`;
        }

        const order = result.data;

        return JSON.stringify({
          type: "order_created",
          orderId: order.id,
          items: order.items,
          totalMinor: order.totalMinor,
          deliveryAddress: order.deliveryAddress,
          contactPhone: order.contactPhone,
        });
      } catch (err) {
        return `Ошибка при оформлении: ${err instanceof Error ? err.message : "неизвестная ошибка"}`;
      }
    },
    render: ({ args, status, result }: any) => {
      if (status === "inProgress") {
        return (
          <div className="p-3 rounded-lg text-sm bg-blue-50 text-blue-800 border border-blue-200">
            Оформляю заказ...
          </div>
        );
      }
      if (!result) return <></>;

      let data: any = result;
      if (typeof result === "string") {
        try {
          data = JSON.parse(result);
        } catch {
          const isError = result.includes("Ошибка") || result.includes("пуста") || result.includes("нужно войти") || result.includes("К сожалению");
          return (
            <div className={`p-3 rounded-lg text-sm ${isError ? "bg-red-50 text-red-800 border border-red-200" : "bg-green-50 text-green-800 border border-green-200"}`}>
              {result}
            </div>
          );
        }
      }

      if (data && data.type === "order_created") {
        return (
          <OrderConfirmation
            orderId={data.orderId}
            items={data.items}
            totalMinor={data.totalMinor}
            deliveryAddress={data.deliveryAddress}
            contactPhone={data.contactPhone}
          />
        );
      }

      const text = typeof data === "string" ? data : JSON.stringify(data);
      return (
        <div className="p-3 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
          {text}
        </div>
      );
    },
    followUp: false,
  }, [cart, user]);

  useCopilotAction({
    name: "getOrderStatus",
    description: "Показать статус заказа или всех заказов пользователя",
    parameters: [
      { name: "orderId", type: "string", description: "Номер заказа (необязательно, если не указан — показать все)" },
    ],
    handler: async ({ orderId }: any) => {
      if (!user) {
        return "Для просмотра заказов нужно войти в аккаунт.";
      }

      if (orderId) {
        const result = await apiFetch(`/api/orders/${orderId}`);
        if (!result.success) {
          return `Заказ не найден: ${result.error || "неизвестная ошибка"}`;
        }
        const order = result.data;
        const statusMap: Record<string, string> = {
          created: "Создан",
          paid: "Оплачен",
          shipped: "Отправлен",
          delivered: "Доставлен",
          cancelled: "Отменён",
        };
        return `Заказ #${order.id.slice(0, 8)}\nСтатус: ${statusMap[order.status] || order.status}\nСумма: ${order.totalMinor / 100}₸\nАдрес: ${order.deliveryAddress}\nТелефон: ${order.contactPhone}`;
      }

      const result = await apiFetch("/api/orders?limit=5");
      if (!result.success || !result.data?.length) {
        return "У вас пока нет заказов. Хотите оформить первый?";
      }

      const statusMap: Record<string, string> = {
        created: "Создан",
        paid: "Оплачен",
        shipped: "Отправлен",
        delivered: "Доставлен",
        cancelled: "Отменён",
      };

      const lines = result.data.map((o: any) =>
        `#${o.id.slice(0, 8)} — ${statusMap[o.status] || o.status} — ${o.totalMinor / 100}₸`
      );
      return `Ваши последние заказы:\n${lines.join("\n")}`;
    },
    followUp: false,
  }, [user]);

  return null;
}
