import { D1Database } from "@cloudflare/workers-types";
import { Session, SessionSchema, now, uuid } from "@baqsha/shared";

export class SessionRepository {
  constructor(private db: D1Database) {}

  async findById(id: string): Promise<Session | null> {
    const { results } = await this.db.prepare("SELECT * FROM sessions WHERE id = ?").bind(id).all();
    return results[0] ? this.mapRow(results[0]) : null;
  }

  async findByUserId(userId: string): Promise<Session | null> {
    const { results } = await this.db.prepare("SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").bind(userId).all();
    return results[0] ? this.mapRow(results[0]) : null;
  }

  async create(userId: string, expiresInSeconds = 7 * 24 * 60 * 60): Promise<Session> {
    const id = uuid();
    const timestamp = now();
    const expiresAt = timestamp + expiresInSeconds * 1000;

    await this.db.prepare("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
      .bind(id, userId, expiresAt, timestamp).run();

    return { id, userId, expiresAt, createdAt: timestamp };
  }

  async delete(id: string): Promise<void> {
    await this.db.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
  }

  async deleteExpired(): Promise<void> {
    await this.db.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now()).run();
  }

  private mapRow(row: any): Session {
    return SessionSchema.parse({
      id: row.id,
      userId: row.user_id,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    });
  }
}