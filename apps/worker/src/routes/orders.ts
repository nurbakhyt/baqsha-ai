import { Hono } from "hono";
import { OrderRepository } from "../domain/repositories/orderRepository";
import { ProductRepository } from "../domain/repositories/productRepository";
import { CreateOrderInputSchema, now } from "@baqsha/shared";
import type { AppEnv } from "../types";

const orders = new Hono<AppEnv>();

orders.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const input = CreateOrderInputSchema.safeParse(body);

  if (!input.success) {
    return c.json({ success: false, error: input.error.flatten().fieldErrors }, 400);
  }

  // Check idempotency
  const orderRepo = new OrderRepository(c.env.DB);
  const existingOrder = await orderRepo.findByIdempotencyKey(input.data.idempotencyKey);
  if (existingOrder) {
    return c.json({ success: true, data: existingOrder });
  }

  // Look up products from DB (never trust client prices)
  const productRepo = new ProductRepository(c.env.DB);
  const products = await productRepo.findByIds(input.data.items.map((i) => i.productId));
  const productById = new Map(products.map((p) => [p.id, p]));

  // Validate every item: product exists, active, in stock
  for (const item of input.data.items) {
    const product = productById.get(item.productId);
    if (!product || !product.isActive) {
      return c.json({
        success: false,
        error: "Product not found",
        productId: item.productId,
      }, 404);
    }
    if (product.stock < item.quantity) {
      return c.json({
        success: false,
        error: "Insufficient stock",
        productId: product.id,
        name: product.name,
        available: product.stock,
      }, 409);
    }
  }

  // Build order snapshot from DB
  const orderItems = input.data.items.map((item) => {
    const product = productById.get(item.productId)!;
    return {
      productId: product.id,
      name: product.name,
      nameEn: product.nameEn,
      nameKk: product.nameKk,
      priceMinor: product.priceMinor,
      quantity: item.quantity,
      package: product.package,
      unit: product.unit,
    };
  });

  const totalMinor = orderItems.reduce((sum, item) => sum + item.priceMinor * item.quantity, 0);

  // Create order with transaction (order + stock decrement)
  const order = await orderRepo.createWithTransaction(
    {
      idempotencyKey: input.data.idempotencyKey,
      userId: user.id,
      status: "created",
      items: orderItems,
      totalMinor,
      deliveryAddress: input.data.deliveryAddress,
      contactPhone: input.data.contactPhone,
      notes: input.data.notes,
      createdAt: now(),
      updatedAt: now(),
    },
    input.data.items.map((item) => ({ id: item.productId, qty: item.quantity }))
  );

  return c.json({ success: true, data: order }, 201);
});

orders.get("/", async (c) => {
  const user = c.get("user");
  const limit = Number(c.req.query("limit") ?? 20);
  const offset = Number(c.req.query("offset") ?? 0);

  const orderRepo = new OrderRepository(c.env.DB);
  const ordersList = await orderRepo.findByUserId(user.id, limit, offset);

  return c.json({ success: true, data: ordersList });
});

orders.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const orderRepo = new OrderRepository(c.env.DB);
  const order = await orderRepo.findById(id);

  if (!order) {
    return c.json({ success: false, error: "Order not found" }, 404);
  }

  if (order.userId !== user.id && user.role !== "admin") {
    return c.json({ success: false, error: "Access denied" }, 403);
  }

  return c.json({ success: true, data: order });
});

orders.post("/:id/cancel", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const orderRepo = new OrderRepository(c.env.DB);
  const order = await orderRepo.findById(id);

  if (!order) {
    return c.json({ success: false, error: "Order not found" }, 404);
  }

  if (order.userId !== user.id && user.role !== "admin") {
    return c.json({ success: false, error: "Access denied" }, 403);
  }

  if (!["created", "paid"].includes(order.status)) {
    return c.json({ success: false, error: "Cannot cancel order in current status" }, 400);
  }

  const cancelledOrder = await orderRepo.cancelWithStockRestore(id);
  return c.json({ success: true, data: cancelledOrder });
});

export default orders;