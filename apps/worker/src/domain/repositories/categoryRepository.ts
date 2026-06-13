import { D1Database } from "@cloudflare/workers-types";
import { Category, CreateCategoryInput, UpdateCategoryInput, CategorySchema, now, uuid } from "@baqsha/shared";

export class CategoryRepository {
  constructor(private db: D1Database) {}

  async findAll(activeOnly = true): Promise<Category[]> {
    const sql = activeOnly
      ? "SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order, name"
      : "SELECT * FROM categories ORDER BY sort_order, name";
    const { results } = await this.db.prepare(sql).all();
    return results.map(this.mapRow);
  }

  async findById(id: string): Promise<Category | null> {
    const { results } = await this.db.prepare("SELECT * FROM categories WHERE id = ?").bind(id).all();
    return results[0] ? this.mapRow(results[0]) : null;
  }

  async findBySlug(slug: string): Promise<Category | null> {
    const { results } = await this.db.prepare("SELECT * FROM categories WHERE slug = ?").bind(slug).all();
    return results[0] ? this.mapRow(results[0]) : null;
  }

  async findChildren(parentId: string): Promise<Category[]> {
    const { results } = await this.db.prepare("SELECT * FROM categories WHERE parent_id = ? AND is_active = 1 ORDER BY sort_order, name").bind(parentId).all();
    return results.map(this.mapRow);
  }

  async findTree(): Promise<Category[]> {
    const all = await this.findAll(true);
    const map = new Map<string, Category & { children: Category[] }>();
    all.forEach(c => map.set(c.id, { ...c, children: [] }));
    const roots: Category[] = [];
    all.forEach(c => {
      if (c.parentId && map.has(c.parentId)) {
        map.get(c.parentId)!.children.push(c);
      } else {
        roots.push(c);
      }
    });
    return roots;
  }

  async create(input: CreateCategoryInput): Promise<Category> {
    const id = uuid();
    const timestamp = now();
    const category: Category = {
      id,
      slug: input.slug,
      name: input.name,
      nameEn: input.nameEn,
      nameKk: input.nameKk,
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder ?? 0,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.db.prepare(`
      INSERT INTO categories (id, slug, name, name_en, name_kk, parent_id, sort_order, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, category.slug, category.name, category.nameEn, category.nameKk, category.parentId, category.sortOrder, 1, timestamp, timestamp).run();
    return category;
  }

  async update(input: UpdateCategoryInput): Promise<Category | null> {
    const existing = await this.findById(input.id);
    if (!existing) return null;

    const updated: Category = {
      ...existing,
      slug: input.slug ?? existing.slug,
      name: input.name ?? existing.name,
      nameEn: input.nameEn ?? existing.nameEn,
      nameKk: input.nameKk ?? existing.nameKk,
      parentId: input.parentId ?? existing.parentId,
      sortOrder: input.sortOrder ?? existing.sortOrder,
      isActive: input.isActive ?? existing.isActive,
      updatedAt: now(),
    };

    await this.db.prepare(`
      UPDATE categories SET slug = ?, name = ?, name_en = ?, name_kk = ?, parent_id = ?, sort_order = ?, is_active = ?, updated_at = ?
      WHERE id = ?
    `).bind(updated.slug, updated.name, updated.nameEn, updated.nameKk, updated.parentId, updated.sortOrder, updated.isActive ? 1 : 0, updated.updatedAt, input.id).run();

    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const { meta } = await this.db.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
    return meta.changes > 0;
  }

  async hasProducts(categoryId: string): Promise<boolean> {
    const { results } = await this.db.prepare("SELECT 1 FROM products WHERE category_id = ? LIMIT 1").bind(categoryId).all();
    return results.length > 0;
  }

  private mapRow(row: any): Category {
    return CategorySchema.parse({
      id: row.id,
      slug: row.slug,
      name: row.name,
      nameEn: row.name_en,
      nameKk: row.name_kk,
      parentId: row.parent_id,
      sortOrder: row.sort_order,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}