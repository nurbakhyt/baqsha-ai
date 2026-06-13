"use client";

import { useFrontendTool, useCopilotReadable, useCopilotAdditionalInstructions } from "@copilotkit/react-core";
import { useStore } from "@/lib/hooks/useStore";

export function CopilotTools() {
  const cart = useStore((s) => s.cart);
  const addToCart = useStore((s) => s.addToCart);
  const removeFromCart = useStore((s) => s.removeFromCart);
  const clearCart = useStore((s) => s.clearCart);

  // System instructions for the agent
  useCopilotAdditionalInstructions({
    instructions: `Ты — помощник по заказу свежих фруктов и овощей в магазине Baqsha.AI.
Доступные инструменты:
- searchProducts: найди товары по запросу (покажи пользователю найденные товары с ценами)
- addToCart: добавь товар в корзину (передай productId, productName, priceMinor, quantity, unit)
- removeFromCart: убери товар из корзины
- showCart: покажи что в корзине
- clearCart: очисти корзину
Когда пользователь просит показать товары — ищи через searchProducts и покажи результат.
Когда пользователь хочет купить — добавляй в корзину через addToCart.
Всегда отвечай на языке пользователя (русский или казахский).`,
  });

  // Share cart state with the agent
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

  // Add to cart
  useFrontendTool({
    name: "addToCart",
    description: "Добавить товар в корзину. Используй когда пользователь хочет купить товар.",
    parameters: [
      { name: "productId", type: "string", description: "ID товара (например prod-001)" },
      { name: "productName", type: "string", description: "Название товара" },
      { name: "priceMinor", type: "number", description: "Цена в тиынках (4500 = 45₸)" },
      { name: "quantity", type: "number", description: "Количество (по умолчанию 1)" },
      { name: "unit", type: "string", description: "Единица измерения (kg, piece, pack)" },
    ],
    handler: async ({ productId, productName, priceMinor, quantity, unit }: any) => {
      addToCart({
        productId,
        name: productName,
        priceMinor,
        quantity: quantity ?? 1,
        package: unit,
        unit,
        mediaKeys: [],
      });
      return `Товар "${productName}" добавлен в корзину (${quantity ?? 1} ${unit})`;
    },
    followUp: true,
  } as any, []);

  // Remove from cart
  useFrontendTool({
    name: "removeFromCart",
    description: "Удалить товар из корзины",
    parameters: [
      { name: "productId", type: "string", description: "ID товара для удаления" },
      { name: "productName", type: "string", description: "Название товара" },
    ],
    handler: async ({ productId, productName }: any) => {
      removeFromCart(productId);
      return `Товар "${productName}" удалён из корзины`;
    },
    followUp: true,
  } as any, []);

  // Show cart
  useFrontendTool({
    name: "showCart",
    description: "Показать содержимое корзины",
    handler: async () => {
      if (cart.length === 0) {
        return "Корзина пуста";
      }
      const items = cart.map((i) => `${i.name} × ${i.quantity} = ${i.priceMinor * i.quantity} тиын`).join("\n");
      const total = cart.reduce((s, i) => s + i.priceMinor * i.quantity, 0);
      return `Корзина:\n${items}\n\nИтого: ${total} тиын (${(total / 100).toFixed(0)}₸)`;
    },
    followUp: true,
  } as any, [cart]);

  // Clear cart
  useFrontendTool({
    name: "clearCart",
    description: "Очистить корзину",
    handler: async () => {
      clearCart();
      return "Корзина очищена";
    },
    followUp: true,
  } as any, []);

  // Search products via API
  useFrontendTool({
    name: "searchProducts",
    description: "Найти товары в каталоге по названию или категории",
    parameters: [
      { name: "query", type: "string", description: "Поисковый запрос (например 'лимон', 'фрукты')" },
    ],
    handler: async ({ query }: any) => {
      const res = await fetch(`/api/catalog/products?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!data.success || !data.data?.length) {
        return `Товары по запросу "${query}" не найдены`;
      }
      const products = data.data.slice(0, 5).map((p: any) =>
        `${p.name} (${p.nameEn}) — ${p.priceMinor / 100}₸/${p.package} [остаток: ${p.stock}]`
      ).join("\n");
      return `Найдено:\n${products}`;
    },
    followUp: true,
  } as any, []);

  return null;
}
