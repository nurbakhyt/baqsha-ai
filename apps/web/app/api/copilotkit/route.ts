import { CopilotRuntime, createCopilotRuntimeHandler, BuiltInAgent } from "@copilotkit/runtime/v2";

const runtime = new CopilotRuntime({
  agents: {
    default: new BuiltInAgent({
      model: "openai:gpt-4o-mini",
    }),
  },
});

const handler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
  cors: true,
});

export async function POST(req: Request) {
  return handler(req);
}
