import { Hono } from "hono";
import { CartRepository } from "../domain/repositories/cartRepository";
import { ProductRepository } from "../domain/repositories/productRepository";
import { CartItemSchema, CartItem } from "@baqsha/shared";
import type { AppEnv } from "../types";

const cart = new Hono<AppEnv>();

cart.get("/", async (c) => {
  const user = c.get("user");
  const cartRepo = new CartRepository(c.env.DB);
  const cartData = await cartRepo.getCart(user.id);
  return c.json({ success: true, data: cartData });
});

cart.post("/items", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();

  const input = CartItemSchema.safeParse({
    productId: body.productId,
    quantity: body.quantity ?? 1,
    priceMinor: 0, // will be filled from product
    name: "",
    package: "",
    unit: "",
    mediaKeys: [],
  });

  if (!input.success) {
    return c.json({ success: false, error: "Invalid input" }, 400);
  }

  const productRepo = new ProductRepository(c.env.DB);
  const product = await productRepo.findById(body.productId);
  if (!product || !product.isActive) {
    return c.json({ success: false, error: "Product not found" }, 404);
  }

  if (product.stock < (body.quantity ?? 1)) {
    return c.json({ success: false, error: "Insufficient stock" }, 400);
  }

  const cartRepo = new CartRepository(c.env.DB);
  const existingCart = await cartRepo.getCart(user.id);

  const existingItemIndex = existingCart.items.findIndex(i => i.productId === body.productId);
  const newQuantity = existingItemIndex >= 0
    ? existingCart.items[existingItemIndex].quantity + (body.quantity ?? 1)
    : (body.quantity ?? 1);

  if (newQuantity > product.stock) {
    return c.json({ success: false, error: "Insufficient stock" }, 400);
  }

  const cartItem: CartItem = {
    productId: product.id,
    quantity: newQuantity,
    priceMinor: product.priceMinor,
    name: product.name,
    package: product.package,
    unit: product.unit,
    mediaKeys: product.mediaKeys,
  };

  let items: CartItem[];
  if (existingItemIndex >= 0) {
    items = [...existingCart.items];
    items[existingItemIndex] = cartItem;
  } else {
    items = [...existingCart.items, cartItem];
  }

  const updatedCart = await cartRepo.upsertCart(user.id, items);
  return c.json({ success: true, data: updatedCart });
});

cart.put("/items/:productId", async (c) => {
  const user = c.get("user");
  const productId = c.req.param("productId");
  const body = await c.req.json();
  const quantity = body.quantity;

  if (typeof quantity !== "number" || quantity < 0) {
    return c.json({ success: false, error: "Invalid quantity" }, 400);
  }

  const cartRepo = new CartRepository(c.env.DB);
  const existingCart = await cartRepo.getCart(user.id);

  if (quantity === 0) {
    const items = existingCart.items.filter(i => i.productId !== productId);
    const updatedCart = await cartRepo.upsertCart(user.id, items);
    return c.json({ success: true, data: updatedCart });
  }

  const productRepo = new ProductRepository(c.env.DB);
  const product = await productRepo.findById(productId);
  if (!product || !product.isActive) {
    return c.json({ success: false, error: "Product not found" }, 404);
  }

  if (quantity > product.stock) {
    return c.json({ success: false, error: "Insufficient stock" }, 400);
  }

  const itemIndex = existingCart.items.findIndex(i => i.productId === productId);
  if (itemIndex < 0) {
    return c.json({ success: false, error: "Item not in cart" }, 404);
  }

  const items = [...existingCart.items];
  items[itemIndex] = { ...items[itemIndex], quantity };
  const updatedCart = await cartRepo.upsertCart(user.id, items);
  return c.json({ success: true, data: updatedCart });
});

cart.delete("/items/:productId", async (c) => {
  const user = c.get("user");
  const productId = c.req.param("productId");

  const cartRepo = new CartRepository(c.env.DB);
  const existingCart = await cartRepo.getCart(user.id);
  const items = existingCart.items.filter(i => i.productId !== productId);
  const updatedCart = await cartRepo.upsertCart(user.id, items);
  return c.json({ success: true, data: updatedCart });
});

cart.delete("/", async (c) => {
  const user = c.get("user");
  const cartRepo = new CartRepository(c.env.DB);
  await cartRepo.clearCart(user.id);
  return c.json({ success: true });
});

export default cart;