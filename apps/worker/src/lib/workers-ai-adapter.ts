import type {
  CopilotServiceAdapter,
  CopilotRuntimeChatCompletionRequest,
  CopilotRuntimeChatCompletionResponse,
} from "@copilotkit/runtime";

function flattenContent(content: any): string {
  if (typeof content === "string") return content;
  if (content === null || content === undefined) return "";
  if (Array.isArray(content)) {
    return content
      .map((part: any) => {
        if (typeof part === "string") return part;
        if (part.type === "text") return part.text || "";
        if (part.type === "image_url") return "[image]";
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return String(content);
}

function convertMessages(request: CopilotRuntimeChatCompletionRequest) {
  const { messages } = request;
  const out: any[] = [];

  const validToolUseIds = new Set<string>();
  for (const msg of messages) {
    if (msg.isActionExecutionMessage()) validToolUseIds.add(msg.id);
  }

  for (const msg of messages) {
    if (msg.isTextMessage()) {
      out.push({ role: msg.role, content: flattenContent(msg.content) });
    } else if (msg.isActionExecutionMessage()) {
      out.push({
        role: "assistant",
        content: "",
        tool_calls: [
          {
            id: msg.id,
            type: "function",
            function: {
              name: msg.name,
              arguments: JSON.stringify(msg.arguments),
            },
          },
        ],
      });
    } else if (msg.isResultMessage()) {
      if (validToolUseIds.has(msg.actionExecutionId)) {
        out.push({
          role: "tool",
          tool_call_id: msg.actionExecutionId,
          content: flattenContent(msg.result),
        });
      }
    }
  }
  return out;
}

export function createWorkersAIAdapter(
  aiBinding: any,
  model: string
): CopilotServiceAdapter {
  return {
    async process(
      request: CopilotRuntimeChatCompletionRequest
    ): Promise<CopilotRuntimeChatCompletionResponse> {
      const { threadId, actions, forwardedParameters, eventSource } = request;
      const resolvedThreadId = threadId || crypto.randomUUID();

      const messages = convertMessages(request);

      const tools =
        actions.length > 0
          ? actions.map((a) => {
              let params: Record<string, unknown> = {};
              try {
                params = JSON.parse(a.jsonSchema || "{}");
              } catch {}
              return {
                type: "function",
                function: {
                  name: a.name,
                  description: a.description,
                  parameters: params,
                },
              };
            })
          : undefined;

      const body: Record<string, unknown> = {
        messages,
        stream: true,
      };
      if (tools) {
        body.tools = tools;
        body.tool_choice = "auto";
      }
      if (forwardedParameters?.maxTokens != null)
        body.max_tokens = forwardedParameters.maxTokens;
      if (forwardedParameters?.stop != null)
        body.stop = forwardedParameters.stop;
      if (forwardedParameters?.temperature != null)
        body.temperature = forwardedParameters.temperature;

      const stream = await aiBinding.run(model, body);

      if (!stream) {
        throw new Error("[WorkersAI] Empty response from AI binding");
      }

      eventSource.stream(async (eventStream$) => {
        let mode: "message" | "function" | null = null;
        let currentMessageId = "";
        let currentToolCallId = "";
        let contentBuffer = "";

        try {
          let chunkCount = 0;
          for await (const chunk of stream) {
            const text = chunk.response || "";
            const toolCalls = chunk.tool_calls;

            if (chunkCount < 3) {
              console.log("[WorkersAI] Chunk:", JSON.stringify(chunk).slice(0, 300));
            }
            chunkCount++;

            if (toolCalls && toolCalls.length > 0) {
              for (const tc of toolCalls) {
                if (mode === "message") {
                  eventStream$.sendTextMessageEnd({ messageId: currentMessageId });
                  mode = null;
                }

                if (mode !== "function") {
                  const execId = tc.id || crypto.randomUUID();
                  currentToolCallId = execId;
                  mode = "function";
                  eventStream$.sendActionExecutionStart({
                    actionExecutionId: currentToolCallId,
                    parentMessageId: currentMessageId || chunkCount.toString(),
                    actionName: tc.function?.name ?? "",
                  });
                }

                if (tc.function?.arguments) {
                  eventStream$.sendActionExecutionArgs({
                    actionExecutionId: currentToolCallId,
                    args: tc.function.arguments,
                  });
                }
              }
            } else if (text) {
              if (mode === "function") {
                eventStream$.sendActionExecutionEnd({ actionExecutionId: currentToolCallId });
                mode = null;
              }

              if (mode !== "message") {
                currentMessageId = chunkCount.toString();
                contentBuffer = "";
                mode = "message";
                eventStream$.sendTextMessageStart({ messageId: currentMessageId });
              }

              contentBuffer += text;
              eventStream$.sendTextMessageContent({ messageId: currentMessageId, content: text });

              const toolMatch = contentBuffer.match(
                /\{"name"\s*:\s*"(addToCart|removeFromCart|showCart|clearCart)"\s*,\s*"parameters"\s*:\s*(\{[^}]+\})\s*\}/
              );
              if (toolMatch) {
                const toolName = toolMatch[1];
                let toolArgs: any = {};
                try {
                  toolArgs = JSON.parse(toolMatch[2]);
                } catch {}

                eventStream$.sendTextMessageEnd({ messageId: currentMessageId });

                const execId = crypto.randomUUID();
                currentToolCallId = execId;
                mode = "function";
                eventStream$.sendActionExecutionStart({
                  actionExecutionId: execId,
                  parentMessageId: currentMessageId,
                  actionName: toolName,
                });
                eventStream$.sendActionExecutionArgs({
                  actionExecutionId: execId,
                  args: JSON.stringify(toolArgs),
                });
                eventStream$.sendActionExecutionEnd({ actionExecutionId: execId });
                contentBuffer = "";
              }
            }
          }

          if (mode === "message") {
            eventStream$.sendTextMessageEnd({ messageId: currentMessageId });
          } else if (mode === "function") {
            eventStream$.sendActionExecutionEnd({ actionExecutionId: currentToolCallId });
          }
        } catch (error) {
          console.error("[WorkersAI] Stream error:", error);
        } finally {
          eventStream$.complete();
        }
      });

      return { threadId: resolvedThreadId };
    },
  };
}
