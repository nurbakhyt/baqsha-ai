export const shopperTools = [
  {
    name: "searchProducts",
    description: "Поиск товаров по названию, категории или описанию",
    parameters: [
      { name: "query", type: "string", description: "Поисковый запрос" },
      { name: "categoryId", type: "string", description: "ID категории (опционально)" },
    ],
  },
  {
    name: "getProductDetails",
    description: "Получить детали конкретного товара",
    parameters: [
      { name: "productId", type: "string", description: "ID товара" },
    ],
  },
  {
    name: "addToCart",
    description: "Добавить товар в корзину",
    parameters: [
      { name: "productId", type: "string", description: "ID товара" },
      { name: "quantity", type: "number", description: "Количество" },
    ],
  },
  {
    name: "getCart",
    description: "Получить текущую корзину",
    parameters: [],
  },
  {
    name: "clearCart",
    description: "Очистить корзину",
    parameters: [],
  },
  {
    name: "createOrder",
    description: "Оформить заказ из корзины",
    parameters: [
      { name: "deliveryAddress", type: "string", description: "Адрес доставки" },
      { name: "contactPhone", type: "string", description: "Телефон для связи" },
      { name: "notes", type: "string", description: "Примечания к заказу" },
    ],
  },
  {
    name: "getOrderStatus",
    description: "Проверить статус заказа",
    parameters: [
      { name: "orderId", type: "string", description: "ID заказа" },
    ],
  },
  {
    name: "getMyOrders",
    description: "Получить список моих заказов",
    parameters: [],
  },
];