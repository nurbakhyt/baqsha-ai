import { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";
import { createWorkersAIAdapter } from "@/lib/workers-ai-adapter";

const runtime = new CopilotRuntime({});

const endpoint = copilotRuntimeNextJSAppRouterEndpoint({
  runtime,
  serviceAdapter: createWorkersAIAdapter(),
  endpoint: "/api/copilotkit",
});

export async function POST(req: Request) {
  return endpoint.handleRequest(req);
}
