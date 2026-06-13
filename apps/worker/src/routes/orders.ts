import { Hono } from "hono";
import { OrderRepository } from "../domain/repositories/orderRepository";
import { CartRepository } from "../domain/repositories/cartRepository";
import { CreateOrderInputSchema, now, Order } from "@baqsha/shared";

const orders = new Hono();

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

  // Get cart
  const cartRepo = new CartRepository(c.env.DB);
  const cart = await cartRepo.getCart(user.id);

  if (!cart.items.length) {
    return c.json({ success: false, error: "Cart is empty" }, 400);
  }

  // Create order items (snapshot) and calculate total
  const orderItems = cart.items.map(item => ({
    productId: item.productId,
    name: item.name,
    priceMinor: item.priceMinor,
    quantity: item.quantity,
    package: item.package,
    unit: item.unit,
  }));

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
    cart.items.map(item => ({ id: item.productId, qty: item.quantity }))
  );

  // Clear cart
  await cartRepo.clearCart(user.id);

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