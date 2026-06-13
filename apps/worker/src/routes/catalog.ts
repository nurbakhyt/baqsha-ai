import { Hono } from "hono";
import { ProductRepository } from "../domain/repositories/productRepository";
import { CategoryRepository } from "../domain/repositories/categoryRepository";
import { CacheService } from "../services/cache";
import { ProductFiltersSchema, PaginationSchema } from "@baqsha/shared";

const catalog = new Hono();

catalog.get("/categories", async (c) => {
  const cache = new CacheService(c.env.CACHE);
  let categories = await cache.getCategories();

  if (!categories) {
    const repo = new CategoryRepository(c.env.DB);
    categories = await repo.findTree();
    await cache.setCategories(categories);
  }

  return c.json({ success: true, data: categories });
});

catalog.get("/categories/:slug", async (c) => {
  const slug = c.req.param("slug");
  const repo = new CategoryRepository(c.env.DB);
  const category = await repo.findBySlug(slug);
  if (!category) {
    return c.json({ success: false, error: "Category not found" }, 404);
  }
  return c.json({ success: true, data: category });
});

catalog.get("/products", async (c) => {
  const page = Number(c.req.query("page") ?? 1);
  const limit = Number(c.req.query("limit") ?? 20);
  const categoryId = c.req.query("categoryId") ?? undefined;
  const search = c.req.query("search") ?? undefined;

  const filters = ProductFiltersSchema.parse({
    inStockOnly: c.req.query("inStockOnly") !== "false",
    categoryId,
    search,
    minPrice: c.req.query("minPrice") ? Number(c.req.query("minPrice")) : undefined,
    maxPrice: c.req.query("maxPrice") ? Number(c.req.query("maxPrice")) : undefined,
  });

  const repo = new ProductRepository(c.env.DB);
  const products = await repo.findAll(filters);
  const total = await repo.count(filters);

  const offset = (page - 1) * limit;
  const paginated = products.slice(offset, offset + limit);

  return c.json({
    success: true,
    data: paginated,
    meta: { page, limit, total },
  });
});

catalog.get("/products/:id", async (c) => {
  const id = c.req.param("id");
  const repo = new ProductRepository(c.env.DB);
  const product = await repo.findById(id);
  if (!product) {
    return c.json({ success: false, error: "Product not found" }, 404);
  }
  return c.json({ success: true, data: product });
});

export default catalog;