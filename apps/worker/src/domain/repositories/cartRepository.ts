import { D1Database } from "@cloudflare/workers-types";
import { Cart, CartItem, CartSchema, now } from "@baqsha/shared";

export class CartRepository {
  constructor(private db: D1Database) {}

  async getCart(userId: string): Promise<Cart> {
    const { results } = await this.db.prepare("SELECT * FROM carts WHERE user_id = ?").bind(userId).all();
    if (!results[0]) {
      const newCart: Cart = { id: userId, userId, items: [], updatedAt: now() };
      return newCart;
    }
    return this.mapRow(results[0]);
  }

  async upsertCart(userId: string, items: CartItem[]): Promise<Cart> {
    const timestamp = now();
    const { results } = await this.db.prepare("SELECT id FROM carts WHERE user_id = ?").bind(userId).all();

    if (results[0]) {
      await this.db.prepare("UPDATE carts SET items = ?, updated_at = ? WHERE user_id = ?")
        .bind(JSON.stringify(items), timestamp, userId).run();
    } else {
      await this.db.prepare("INSERT INTO carts (id, user_id, items, updated_at) VALUES (?, ?, ?, ?)")
        .bind(userId, userId, JSON.stringify(items), timestamp).run();
    }

    return { id: userId, userId, items, updatedAt: timestamp };
  }

  async clearCart(userId: string): Promise<void> {
    await this.db.prepare("DELETE FROM carts WHERE user_id = ?").bind(userId).run();
  }

  private mapRow(row: any): Cart {
    return CartSchema.parse({
      id: row.id,
      userId: row.user_id,
      items: typeof row.items === "string" ? JSON.parse(row.items) : row.items,
      updatedAt: row.updated_at,
    });
  }
}