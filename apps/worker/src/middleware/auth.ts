import { Context, Next } from "hono";
import { SessionRepository } from "../domain/repositories/sessionRepository";
import { UserRepository } from "../domain/repositories/userRepository";

export interface AuthEnv {
  DB: any;
  CACHE: any;
  JWT_SECRET: string;
}

export async function authMiddleware(c: Context<AuthEnv>, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ success: false, error: "Missing or invalid Authorization header" }, 401);
  }

  const token = authHeader.slice(7);
  const sessionRepo = new SessionRepository(c.env.DB);
  const userRepo = new UserRepository(c.env.DB);

  const session = await sessionRepo.findById(token);
  if (!session) {
    return c.json({ success: false, error: "Invalid session" }, 401);
  }

  if (session.expiresAt < Date.now()) {
    await sessionRepo.delete(session.id);
    return c.json({ success: false, error: "Session expired" }, 401);
  }

  const user = await userRepo.findById(session.userId);
  if (!user) {
    return c.json({ success: false, error: "User not found" }, 401);
  }

  c.set("user", user);
  c.set("session", session);
  await next();
}

export async function adminGuard(c: Context<AuthEnv>, next: Next) {
  const user = c.get("user");
  if (!user || user.role !== "admin") {
    return c.json({ success: false, error: "Admin access required" }, 403);
  }
  await next();
}

export async function optionalAuthMiddleware(c: Context<AuthEnv>, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const sessionRepo = new SessionRepository(c.env.DB);
    const userRepo = new UserRepository(c.env.DB);

    const session = await sessionRepo.findById(token);
    if (session && session.expiresAt > Date.now()) {
      const user = await userRepo.findById(session.userId);
      if (user) {
        c.set("user", user);
        c.set("session", session);
      }
    }
  }
  await next();
}