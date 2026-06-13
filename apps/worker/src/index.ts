import { Hono } from "hono";
import { cors } from "hono/cors";
import { CopilotRuntime, createCopilotRuntimeHandler, BuiltInAgent } from "@copilotkit/runtime/v2";
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
  OPENAI_API_KEY: string;
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

// CopilotKit runtime
app.post("/api/copilotkit", async (c) => {
  const runtime = new CopilotRuntime({
    agents: {
      default: new BuiltInAgent({
        model: "openai:gpt-4o-mini",
        instructions: [
          "You are a helpful shopping assistant for Baqsha.AI - a fresh fruit and vegetable delivery service.",
          "Help users find products, build their cart, place orders, and track deliveries.",
          "When showing products, use the ProductCard component to display them with images, prices, and stock info.",
          "When showing cart items, use the CartDrawer component.",
          "Always respond in the user's language (Russian or English).",
        ].join("\n"),
      }),
    },
  });

  const handler = createCopilotRuntimeHandler({
    runtime,
    basePath: "/api/copilotkit",
    cors: true,
  });

  return handler(c.req.raw);
});

// 404
app.notFound((c) => c.json({ success: false, error: "Not found" }, 404));

// Error handler
app.onError((err, c) => {
  console.error("Worker error:", err);
  return c.json({ success: false, error: "Internal server error" }, 500);
});

export default app;