import { Hono } from "hono";
import { CategoryRepository } from "../domain/repositories/categoryRepository";
import { ProductRepository } from "../domain/repositories/productRepository";
import { OrderRepository } from "../domain/repositories/orderRepository";
import { CacheService } from "../services/cache";
import { CreateCategoryInputSchema, UpdateCategoryInputSchema, CreateProductInputSchema, UpdateProductInputSchema, UpdateOrderStatusInputSchema } from "@baqsha/shared";
import type { AppEnv } from "../types";

const admin = new Hono<AppEnv>();

// Category CRUD
admin.post("/categories", async (c) => {
  const body = await c.req.json();
  const input = CreateCategoryInputSchema.safeParse(body);
  if (!input.success) {
    return c.json({ success: false, error: input.error.flatten().fieldErrors }, 400);
  }

  const repo = new CategoryRepository(c.env.DB);
  const existing = await repo.findBySlug(input.data.slug);
  if (existing) {
    return c.json({ success: false, error: "Slug already exists" }, 409);
  }

  const category = await repo.create(input.data);
  const cache = new CacheService(c.env.CACHE);
  await cache.invalidateCategories();

  return c.json({ success: true, data: category }, 201);
});

admin.put("/categories/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const input = UpdateCategoryInputSchema.safeParse({ ...body, id });
  if (!input.success) {
    return c.json({ success: false, error: input.error.flatten().fieldErrors }, 400);
  }

  const repo = new CategoryRepository(c.env.DB);
  const category = await repo.update({ ...input.data, id });
  if (!category) {
    return c.json({ success: false, error: "Category not found" }, 404);
  }

  const cache = new CacheService(c.env.CACHE);
  await cache.invalidateCategories();

  return c.json({ success: true, data: category });
});

admin.delete("/categories/:id", async (c) => {
  const id = c.req.param("id");
  const repo = new CategoryRepository(c.env.DB);

  const hasProducts = await repo.hasProducts(id);
  if (hasProducts) {
    return c.json({ success: false, error: "Cannot delete category with products" }, 400);
  }

  const deleted = await repo.delete(id);
  if (!deleted) {
    return c.json({ success: false, error: "Category not found" }, 404);
  }

  const cache = new CacheService(c.env.CACHE);
  await cache.invalidateCategories();

  return c.json({ success: true });
});

// Product CRUD
admin.post("/products", async (c) => {
  const body = await c.req.json();
  const input = CreateProductInputSchema.safeParse(body);
  if (!input.success) {
    return c.json({ success: false, error: input.error.flatten().fieldErrors }, 400);
  }

  const repo = new ProductRepository(c.env.DB);
  const existing = await repo.findBySku(input.data.sku);
  if (existing) {
    return c.json({ success: false, error: "SKU already exists" }, 409);
  }

  const product = await repo.create(input.data);
  const cache = new CacheService(c.env.CACHE);
  await cache.invalidateProducts();

  return c.json({ success: true, data: product }, 201);
});

admin.put("/products/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const input = UpdateProductInputSchema.safeParse({ ...body, id });
  if (!input.success) {
    return c.json({ success: false, error: input.error.flatten().fieldErrors }, 400);
  }

  const repo = new ProductRepository(c.env.DB);
  const product = await repo.update({ ...input.data, id });
  if (!product) {
    return c.json({ success: false, error: "Product not found" }, 404);
  }

  const cache = new CacheService(c.env.CACHE);
  await cache.invalidateProducts();

  return c.json({ success: true, data: product });
});

admin.delete("/products/:id", async (c) => {
  const id = c.req.param("id");
  const repo = new ProductRepository(c.env.DB);
  const deleted = await repo.delete(id);

  if (!deleted) {
    return c.json({ success: false, error: "Product not found" }, 404);
  }

  const cache = new CacheService(c.env.CACHE);
  await cache.invalidateProducts();

  return c.json({ success: true });
});

admin.post("/products/:id/stock", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const delta = body.delta;

  if (typeof delta !== "number") {
    return c.json({ success: false, error: "delta must be a number" }, 400);
  }

  const repo = new ProductRepository(c.env.DB);
  const product = await repo.adjustStock(id, delta);
  if (!product) {
    return c.json({ success: false, error: "Product not found" }, 404);
  }

  const cache = new CacheService(c.env.CACHE);
  await cache.invalidateProducts();

  return c.json({ success: true, data: product });
});

// Order management
admin.get("/orders", async (c) => {
  const status = c.req.query("status") as any;
  const limit = Number(c.req.query("limit") ?? 50);
  const offset = Number(c.req.query("offset") ?? 0);

  const repo = new OrderRepository(c.env.DB);
  const result = await repo.findAll(status, limit, offset);

  return c.json({ success: true, data: result.orders, meta: { total: result.total, limit, offset } });
});

admin.put("/orders/:id/status", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const input = UpdateOrderStatusInputSchema.safeParse({ ...body, orderId: id });
  if (!input.success) {
    return c.json({ success: false, error: input.error.flatten().fieldErrors }, 400);
  }

  const repo = new OrderRepository(c.env.DB);

  // Validate status transitions
  const order = await repo.findById(id);
  if (!order) {
    return c.json({ success: false, error: "Order not found" }, 404);
  }

  const validTransitions: Record<string, string[]> = {
    created: ["paid", "cancelled"],
    paid: ["shipped", "cancelled"],
    shipped: ["delivered"],
    delivered: [],
    cancelled: [],
  };

  if (!validTransitions[order.status]?.includes(input.data.status)) {
    return c.json({
      success: false,
      error: `Invalid status transition: ${order.status} -> ${input.data.status}`,
    }, 400);
  }

  const updatedOrder = await repo.updateStatus(id, input.data.status);
  return c.json({ success: true, data: updatedOrder });
});

export default admin;