import { Hono } from "hono";
import { cors } from "hono/cors";

type Env = {
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL: string;
  CORS_ORIGIN: string;
};

const copilot = new Hono<{ Bindings: Env }>();

copilot.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "x-copilotkit-runtime-client-gql-version"],
  credentials: true,
}));

let handlerCache: any = null;

async function getHandler(env: Env) {
  if (handlerCache) return handlerCache;

  const { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint, OpenAIAdapter } = await import("@copilotkit/runtime");
  const OpenAI = (await import("openai")).default;

  const runtime = new CopilotRuntime({});

  const openai = new OpenAI({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
  });

  const serviceAdapter = new OpenAIAdapter({
    openai,
    model: env.OPENROUTER_MODEL || "openrouter/free",
  });

  const endpoint = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  handlerCache = endpoint;
  return endpoint;
}

copilot.all("/", async (c) => {
  try {
    if (!c.env.OPENROUTER_API_KEY) {
      return c.json({ success: false, error: "OPENROUTER_API_KEY not configured" }, 500);
    }

    const endpoint = await getHandler(c.env as Env);

    const response = await endpoint.handleRequest(c.req.raw);

    const newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", "*");
    newHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    newHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-copilotkit-runtime-client-gql-version");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (error) {
    console.error("CopilotKit error:", error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

export default copilot;
