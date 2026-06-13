import { KVNamespace } from "@cloudflare/workers-types";
import { Product, Category } from "@baqsha/shared";

const CATALOG_PRODUCTS_KEY = "catalog:products";
const CATALOG_CATEGORIES_KEY = "catalog:categories";
const CATALOG_TTL = 3600; // 1 hour
const CART_TTL = 86400; // 24 hours

export class CacheService {
  constructor(private kv: KVNamespace) {}

  async getProducts(): Promise<Product[] | null> {
    const data = await this.kv.get(CATALOG_PRODUCTS_KEY, "json");
    return data as Product[] | null;
  }

  async setProducts(products: Product[]): Promise<void> {
    await this.kv.put(CATALOG_PRODUCTS_KEY, JSON.stringify(products), { expirationTtl: CATALOG_TTL });
  }

  async getCategories(): Promise<Category[] | null> {
    const data = await this.kv.get(CATALOG_CATEGORIES_KEY, "json");
    return data as Category[] | null;
  }

  async setCategories(categories: Category[]): Promise<void> {
    await this.kv.put(CATALOG_CATEGORIES_KEY, JSON.stringify(categories), { expirationTtl: CATALOG_TTL });
  }

  async invalidateCatalog(): Promise<void> {
    await this.kv.delete(CATALOG_PRODUCTS_KEY);
    await this.kv.delete(CATALOG_CATEGORIES_KEY);
  }

  async invalidateProducts(): Promise<void> {
    await this.kv.delete(CATALOG_PRODUCTS_KEY);
  }

  async invalidateCategories(): Promise<void> {
    await this.kv.delete(CATALOG_CATEGORIES_KEY);
  }

  async getProductSearch(queryHash: string): Promise<Product[] | null> {
    const data = await this.kv.get(`catalog:search:${queryHash}`, "json");
    return data as Product[] | null;
  }

  async setProductSearch(queryHash: string, products: Product[]): Promise<void> {
    await this.kv.put(`catalog:search:${queryHash}`, JSON.stringify(products), { expirationTtl: 1800 }); // 30 min
  }

  async getSession(id: string): Promise<any | null> {
    const data = await this.kv.get(`session:${id}`, "json");
    return data;
  }

  async setSession(id: string, data: any): Promise<void> {
    await this.kv.put(`session:${id}`, JSON.stringify(data), { expirationTtl: CART_TTL });
  }

  async deleteSession(id: string): Promise<void> {
    await this.kv.delete(`session:${id}`);
  }
}