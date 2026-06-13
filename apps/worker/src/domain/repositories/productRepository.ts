import { D1Database } from "@cloudflare/workers-types";
import { Product, ProductWithCategory, CreateProductInput, UpdateProductInput, ProductFilters, ProductSchema, now, uuid } from "@baqsha/shared";

export class ProductRepository {
  constructor(private db: D1Database) {}

  async findAll(filters: ProductFilters = {}): Promise<Product[]> {
    const conditions = ["p.is_active = 1"];
    const bindings: any[] = [];

    if (filters.inStockOnly) {
      conditions.push("p.stock > 0");
    }
    if (filters.categoryId) {
      conditions.push("p.category_id = ?");
      bindings.push(filters.categoryId);
    }
    if (filters.search) {
      conditions.push("(p.name LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)");
      const q = `%${filters.search}%`;
      bindings.push(q, q, q);
    }
    if (filters.minPrice) {
      conditions.push("p.price_minor >= ?");
      bindings.push(filters.minPrice);
    }
    if (filters.maxPrice) {
      conditions.push("p.price_minor <= ?");
      bindings.push(filters.maxPrice);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `
      SELECT p.*, c.name as category_name, c.slug as category_slug, c.id as category_id_full
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${where}
      ORDER BY p.created_at DESC
    `;

    const { results } = await this.db.prepare(sql).bind(...bindings).all();
    return results.map(this.mapRow);
  }

  async findById(id: string): Promise<Product | null> {
    const { results } = await this.db.prepare("SELECT * FROM products WHERE id = ?").bind(id).all();
    return results[0] ? this.mapRow(results[0]) : null;
  }

  async findBySku(sku: string): Promise<Product | null> {
    const { results } = await this.db.prepare("SELECT * FROM products WHERE sku = ?").bind(sku).all();
    return results[0] ? this.mapRow(results[0]) : null;
  }

  async findByIds(ids: string[]): Promise<Product[]> {
    if (!ids.length) return [];
    const placeholders = ids.map(() => "?").join(",");
    const { results } = await this.db.prepare(
      `SELECT * FROM products WHERE id IN (${placeholders})`
    ).bind(...ids).all();
    return results.map(this.mapRow);
  }

  async count(filters: ProductFilters = {}): Promise<number> {
    const conditions = ["is_active = 1"];
    const bindings: any[] = [];

    if (filters.inStockOnly) conditions.push("stock > 0");
    if (filters.categoryId) {
      conditions.push("category_id = ?");
      bindings.push(filters.categoryId);
    }
    if (filters.search) {
      conditions.push("(name LIKE ? OR description LIKE ? OR sku LIKE ?)");
      const q = `%${filters.search}%`;
      bindings.push(q, q, q);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { results } = await this.db.prepare(
      `SELECT COUNT(*) as count FROM products ${where}`
    ).bind(...bindings).all();
    return (results[0] as any).count;
  }

  async create(input: CreateProductInput): Promise<Product> {
    const id = uuid();
    const timestamp = now();
    const product: Product = {
      id,
      sku: input.sku,
      categoryId: input.categoryId,
      name: input.name,
      nameEn: input.nameEn,
      nameKk: input.nameKk,
      description: input.description,
      descriptionEn: input.descriptionEn,
      descriptionKk: input.descriptionKk,
      priceMinor: input.priceMinor,
      stock: input.stock,
      package: input.package,
      unit: input.unit,
      mediaKeys: input.mediaKeys ?? [],
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await this.db.prepare(`
      INSERT INTO products (id, sku, category_id, name, name_en, name_kk, description, description_en, description_kk, price_minor, stock, package, unit, media_keys, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, product.sku, product.categoryId, product.name, product.nameEn, product.nameKk,
      product.description, product.descriptionEn, product.descriptionKk,
      product.priceMinor, product.stock, product.package, product.unit,
      JSON.stringify(product.mediaKeys), 1, timestamp, timestamp
    ).run();

    return product;
  }

  async update(input: UpdateProductInput): Promise<Product | null> {
    const existing = await this.findById(input.id);
    if (!existing) return null;

    const updated: Product = {
      ...existing,
      sku: input.sku ?? existing.sku,
      categoryId: input.categoryId ?? existing.categoryId,
      name: input.name ?? existing.name,
      nameEn: input.nameEn ?? existing.nameEn,
      nameKk: input.nameKk ?? existing.nameKk,
      description: input.description ?? existing.description,
      descriptionEn: input.descriptionEn ?? existing.descriptionEn,
      descriptionKk: input.descriptionKk ?? existing.descriptionKk,
      priceMinor: input.priceMinor ?? existing.priceMinor,
      stock: input.stock ?? existing.stock,
      package: input.package ?? existing.package,
      unit: input.unit ?? existing.unit,
      mediaKeys: input.mediaKeys ?? existing.mediaKeys,
      isActive: input.isActive ?? existing.isActive,
      updatedAt: now(),
    };

    await this.db.prepare(`
      UPDATE products SET sku = ?, category_id = ?, name = ?, name_en = ?, name_kk = ?,
      description = ?, description_en = ?, description_kk = ?,
      price_minor = ?, stock = ?, package = ?, unit = ?, media_keys = ?, is_active = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      updated.sku, updated.categoryId, updated.name, updated.nameEn, updated.nameKk,
      updated.description, updated.descriptionEn, updated.descriptionKk,
      updated.priceMinor, updated.stock, updated.package, updated.unit,
      JSON.stringify(updated.mediaKeys), updated.isActive ? 1 : 0, updated.updatedAt, input.id
    ).run();

    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const { meta } = await this.db.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
    return meta.changes > 0;
  }

  async adjustStock(id: string, delta: number): Promise<Product | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const newStock = existing.stock + delta;
    if (newStock < 0) {
      throw new Error(`Insufficient stock for product ${existing.name}. Available: ${existing.stock}, requested: ${delta}`);
    }

    await this.db.prepare("UPDATE products SET stock = ?, updated_at = ? WHERE id = ?")
      .bind(newStock, now(), id).run();

    return { ...existing, stock: newStock, updatedAt: now() };
  }

  private mapRow(row: any): Product {
    return ProductSchema.parse({
      id: row.id,
      sku: row.sku,
      categoryId: row.category_id,
      name: row.name,
      nameEn: row.name_en,
      nameKk: row.name_kk,
      description: row.description,
      descriptionEn: row.description_en,
      descriptionKk: row.description_kk,
      priceMinor: Number(row.price_minor),
      stock: Number(row.stock),
      package: row.package,
      unit: row.unit,
      mediaKeys: typeof row.media_keys === "string" ? JSON.parse(row.media_keys) : row.media_keys,
      isActive: Boolean(row.is_active),
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    });
  }
}