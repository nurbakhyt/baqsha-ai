import { Hono } from "hono";
import { UserRepository } from "../domain/repositories/userRepository";
import { SessionRepository } from "../domain/repositories/sessionRepository";
import { RegisterInputSchema, LoginInputSchema } from "@baqsha/shared";

const auth = new Hono();

auth.post("/register", async (c) => {
  const body = await c.req.json();
  const input = RegisterInputSchema.safeParse(body);
  if (!input.success) {
    return c.json({ success: false, error: input.error.flatten().fieldErrors }, 400);
  }

  const userRepo = new UserRepository(c.env.DB);
  const existing = await userRepo.findByEmail(input.data.email);
  if (existing) {
    return c.json({ success: false, error: "Email already registered" }, 409);
  }

  const passwordHash = await hashPassword(input.data.password);
  const user = await userRepo.create({
    email: input.data.email,
    passwordHash,
    name: input.data.name,
    phone: input.data.phone,
  });

  const sessionRepo = new SessionRepository(c.env.DB);
  const session = await sessionRepo.create(user.id);

  return c.json({
    success: true,
    data: {
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role },
      session: { id: session.id, expiresAt: session.expiresAt },
    },
  }, 201);
});

auth.post("/login", async (c) => {
  const body = await c.req.json();
  const input = LoginInputSchema.safeParse(body);
  if (!input.success) {
    return c.json({ success: false, error: "Invalid email or password" }, 401);
  }

  const userRepo = new UserRepository(c.env.DB);
  const user = await userRepo.findByEmail(input.data.email);
  if (!user) {
    return c.json({ success: false, error: "Invalid email or password" }, 401);
  }

  const valid = await verifyPassword(input.data.password, user.passwordHash);
  if (!valid) {
    return c.json({ success: false, error: "Invalid email or password" }, 401);
  }

  const sessionRepo = new SessionRepository(c.env.DB);
  const session = await sessionRepo.create(user.id);

  return c.json({
    success: true,
    data: {
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role },
      session: { id: session.id, expiresAt: session.expiresAt },
    },
  });
});

auth.post("/logout", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const sessionRepo = new SessionRepository(c.env.DB);
    await sessionRepo.delete(authHeader.slice(7));
  }
  return c.json({ success: true });
});

auth.get("/me", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ success: false, error: "Not authenticated" }, 401);
  }
  return c.json({
    success: true,
    data: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role },
  });
});

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

export default auth;