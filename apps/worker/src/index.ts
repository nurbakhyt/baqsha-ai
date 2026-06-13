import { Hono } from "hono";
import { cors } from "hono/cors";
import auth from "./routes/auth";
import catalog from "./routes/catalog";
import cart from "./routes/cart";
import orders from "./routes/orders";
import adminRoutes from "./routes/admin";
import { authMiddleware, adminGuard, AuthEnv } from "./middleware/auth";

type Bindings = {
  DB: any;
  CACHE: any;
  IMAGES: any;
  AI: any;
  JWT_SECRET: string;
  CORS_ORIGIN: string;
};

type Variables = {
  user: any;
  session: any;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// CORS
app.use("*", cors({
  origin: (origin) => origin,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// Health check
app.get("/health", (c) => c.json({ status: "ok", name: "Baqsha.AI", timestamp: Date.now() }));

// Public routes
app.route("/api/auth", auth);
app.route("/api/catalog", catalog);

// Protected routes (require auth)
app.use("/api/cart/*", authMiddleware);
app.use("/api/orders/*", authMiddleware);
app.route("/api/cart", cart);
app.route("/api/orders", orders);

// Admin routes (require auth + admin role)
app.use("/api/admin/*", authMiddleware);
app.use("/api/admin/*", adminGuard);
app.route("/api/admin", adminRoutes);

// 404
app.notFound((c) => c.json({ success: false, error: "Not found" }, 404));

// Error handler
app.onError((err, c) => {
  console.error("Worker error:", err);
  return c.json({ success: false, error: "Internal server error" }, 500);
});

export default app;