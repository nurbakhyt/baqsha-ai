export const adminTools = [
  {
    name: "createProduct",
    description: "Создать новый товар в каталоге",
    parameters: [
      { name: "sku", type: "string", description: "Уникальный артикул" },
      { name: "categoryId", type: "string", description: "ID категории" },
      { name: "name", type: "string", description: "Название товара" },
      { name: "priceMinor", type: "number", description: "Цена в тиынах/копейках" },
      { name: "stock", type: "number", description: "Количество на складе" },
      { name: "package", type: "string", description: "Единица упаковки (1кг, 500г, штука)" },
      { name: "unit", type: "string", description: "Единица измерения (kg, piece, pack, liter)" },
    ],
  },
  {
    name: "updateProduct",
    description: "Обновить данные товара",
    parameters: [
      { name: "id", type: "string", description: "ID товара" },
      { name: "name", type: "string", description: "Название товара" },
      { name: "priceMinor", type: "number", description: "Цена в тиынах/копейках" },
      { name: "stock", type: "number", description: "Количество на складе" },
    ],
  },
  {
    name: "adjustStock",
    description: "Изменить остаток товара",
    parameters: [
      { name: "productId", type: "string", description: "ID товара" },
      { name: "delta", type: "number", description: "Изменение количества (+ или -)" },
    ],
  },
  {
    name: "deleteProduct",
    description: "Удалить товар из каталога",
    parameters: [
      { name: "id", type: "string", description: "ID товара" },
    ],
  },
  {
    name: "createCategory",
    description: "Создать новую категорию",
    parameters: [
      { name: "slug", type: "string", description: "URL-friendly название" },
      { name: "name", type: "string", description: "Отображаемое название" },
    ],
  },
  {
    name: "updateOrderStatus",
    description: "Изменить статус заказа",
    parameters: [
      { name: "orderId", type: "string", description: "ID заказа" },
      { name: "status", type: "string", description: "Новый статус (paid, shipped, delivered, cancelled)" },
    ],
  },
  {
    name: "getOrders",
    description: "Получить список всех заказов",
    parameters: [
      { name: "status", type: "string", description: "Фильтр по статусу (опционально)" },
    ],
  },
];