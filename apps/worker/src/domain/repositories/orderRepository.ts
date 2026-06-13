import { D1Database } from "@cloudflare/workers-types";
import { Order, OrderStatus, OrderSchema, now, uuid } from "@baqsha/shared";

export class OrderRepository {
  constructor(private db: D1Database) {}

  async findById(id: string): Promise<Order | null> {
    const { results } = await this.db.prepare("SELECT * FROM orders WHERE id = ?").bind(id).all();
    return results[0] ? this.mapRow(results[0]) : null;
  }

  async findByIdempotencyKey(key: string): Promise<Order | null> {
    const { results } = await this.db.prepare("SELECT * FROM orders WHERE idempotency_key = ?").bind(key).all();
    return results[0] ? this.mapRow(results[0]) : null;
  }

  async findByUserId(userId: string, limit = 20, offset = 0): Promise<Order[]> {
    const { results } = await this.db.prepare(
      "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
    ).bind(userId, limit, offset).all();
    return results.map(this.mapRow);
  }

  async findAll(status?: OrderStatus, limit = 50, offset = 0): Promise<{ orders: Order[]; total: number }> {
    const conditions: string[] = [];
    const bindings: any[] = [];

    if (status) {
      conditions.push("status = ?");
      bindings.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const countSql = `SELECT COUNT(*) as count FROM orders ${where}`;
    const { results: countResults } = await this.db.prepare(countSql).bind(...bindings).all();
    const total = (countResults[0] as any).count;

    const dataSql = `SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    bindings.push(limit, offset);
    const { results } = await this.db.prepare(dataSql).bind(...bindings).all();

    return { orders: results.map(this.mapRow), total };
  }

  async createWithTransaction(order: Omit<Order, "id">, products: Array<{ id: string; qty: number }>): Promise<Order> {
    const id = uuid();

    // D1 batch: create order + decrement stock
    const statements = [
      this.db.prepare(`
        INSERT INTO orders (id, idempotency_key, user_id, status, items, total_minor, delivery_address, contact_phone, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, order.idempotencyKey, order.userId, order.status, JSON.stringify(order.items),
        order.totalMinor, order.deliveryAddress, order.contactPhone, order.notes ?? null,
        order.createdAt, order.updatedAt
      ),
      ...products.map(p =>
        this.db.prepare("UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ? AND stock >= ?")
          .bind(p.qty, now(), p.id, p.qty)
      ),
    ];

    await this.db.batch(statements);

    return { ...order, id };
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const timestamp = now();
    const updateFields: string[] = ["status = ?", "updated_at = ?"];
    const bindings: any[] = [status, timestamp];

    switch (status) {
      case "paid":
        updateFields.push("paid_at = ?");
        bindings.push(timestamp);
        break;
      case "shipped":
        updateFields.push("shipped_at = ?");
        bindings.push(timestamp);
        break;
      case "delivered":
        updateFields.push("delivered_at = ?");
        bindings.push(timestamp);
        break;
      case "cancelled":
        updateFields.push("cancelled_at = ?");
        bindings.push(timestamp);
        break;
    }

    bindings.push(id);
    await this.db.prepare(`UPDATE orders SET ${updateFields.join(", ")} WHERE id = ?`).bind(...bindings).run();

    return this.findById(id);
  }

  async cancelWithStockRestore(id: string): Promise<Order | null> {
    const order = await this.findById(id);
    if (!order || order.status === "cancelled" || order.status === "delivered") return null;

    const timestamp = now();

    // Restore stock for each item
    const statements = order.items.map(item =>
      this.db.prepare("UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?")
        .bind(item.quantity, timestamp, item.productId)
    );

    // Update order status
    statements.push(
      this.db.prepare("UPDATE orders SET status = ?, cancelled_at = ?, updated_at = ? WHERE id = ?")
        .bind("cancelled", timestamp, timestamp, id)
    );

    await this.db.batch(statements);

    return this.findById(id);
  }

  private mapRow(row: any): Order {
    return OrderSchema.parse({
      id: row.id,
      idempotencyKey: row.idempotency_key,
      userId: row.user_id,
      status: row.status,
      items: typeof row.items === "string" ? JSON.parse(row.items) : row.items,
      totalMinor: Number(row.total_minor),
      deliveryAddress: row.delivery_address,
      contactPhone: row.contact_phone,
      notes: row.notes,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
      paidAt: row.paid_at != null ? Number(row.paid_at) : undefined,
      shippedAt: row.shipped_at != null ? Number(row.shipped_at) : undefined,
      deliveredAt: row.delivered_at != null ? Number(row.delivered_at) : undefined,
      cancelledAt: row.cancelled_at != null ? Number(row.cancelled_at) : undefined,
    });
  }
}