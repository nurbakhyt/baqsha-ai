import { D1Database } from "@cloudflare/workers-types";
import { User, UserSchema, now, uuid } from "@baqsha/shared";

export class UserRepository {
  constructor(private db: D1Database) {}

  async findById(id: string): Promise<User | null> {
    const { results } = await this.db.prepare("SELECT * FROM users WHERE id = ?").bind(id).all();
    return results[0] ? this.mapRow(results[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const { results } = await this.db.prepare("SELECT * FROM users WHERE email = ?").bind(email.toLowerCase()).all();
    return results[0] ? this.mapRow(results[0]) : null;
  }

  async create(data: { email: string; passwordHash: string; name?: string; phone?: string; role?: string }): Promise<User> {
    const id = uuid();
    const timestamp = now();
    const user: User = {
      id,
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      name: data.name,
      phone: data.phone,
      role: (data.role as any) ?? "customer",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await this.db.prepare(`
      INSERT INTO users (id, email, password_hash, name, phone, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, user.email, user.passwordHash, user.name, user.phone, user.role, timestamp, timestamp).run();

    return user;
  }

  async update(id: string, data: Partial<{ name: string; phone: string; role: string }>): Promise<User | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const bindings: any[] = [];

    if (data.name !== undefined) { fields.push("name = ?"); bindings.push(data.name); }
    if (data.phone !== undefined) { fields.push("phone = ?"); bindings.push(data.phone); }
    if (data.role !== undefined) { fields.push("role = ?"); bindings.push(data.role); }

    if (fields.length === 0) return existing;

    fields.push("updated_at = ?");
    bindings.push(now(), id);

    await this.db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).bind(...bindings).run();
    return this.findById(id);
  }

  private mapRow(row: any): User {
    return UserSchema.parse({
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      name: row.name,
      phone: row.phone,
      role: row.role,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    });
  }
}