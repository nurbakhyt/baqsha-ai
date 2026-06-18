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

const ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const PREFIX = "pbkdf2:";

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    key,
    KEY_LENGTH * 8,
  );
  const hash = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, "0")).join("");
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
  return `${PREFIX}${ITERATIONS}:${saltHex}:${hash}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored.startsWith(PREFIX)) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest("SHA-256", data);
    const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
    return hex === stored;
  }
  const [, iterationsStr, saltHex, expectedHash] = stored.split(":");
  const iterations = Number(iterationsStr);
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    KEY_LENGTH * 8,
  );
  const hash = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, "0")).join("");
  return hash === expectedHash;
}

export default auth;