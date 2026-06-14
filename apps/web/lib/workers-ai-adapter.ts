import type {
  CopilotServiceAdapter,
  CopilotRuntimeChatCompletionRequest,
  CopilotRuntimeChatCompletionResponse,
} from "@copilotkit/runtime";

const WORKERS_AI_URL = process.env.WORKERS_AI_URL!;
const WORKERS_AI_KEY = process.env.WORKERS_AI_API_TOKEN!;
const MODEL = process.env.WORKERS_AI_MODEL || "@cf/meta/llama-3.2-3b-instruct";

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

export function createWorkersAIAdapter(): CopilotServiceAdapter {
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
              } catch {
                console.warn("[WorkersAI] Invalid jsonSchema for action:", a.name);
              }
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
        model: MODEL,
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

      const res = await fetch(WORKERS_AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WORKERS_AI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error("[WorkersAI] Request failed:", res.status, errBody);
        throw new Error(`${res.status} ${res.statusText}: ${errBody}`);
      }

      if (!res.body) {
        throw new Error("[WorkersAI] Response body is null");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      eventSource.stream(async (eventStream$) => {
        let mode: "message" | "function" | null = null;
        let currentMessageId = "";
        let currentToolCallId = "";
        let contentBuffer = "";

        try {
          let buffer = "";
          let done = false;
          while (!done) {
            const result = await reader.read();
            done = result.done;
            if (done) break;

            buffer += decoder.decode(result.value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            let streamDone = false;
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") {
                streamDone = true;
                break;
              }

              let parsed: any;
              try {
                parsed = JSON.parse(data);
              } catch {
                continue;
              }

              const choice = parsed.choices?.[0];
              if (!choice) continue;

              const delta = choice.delta;
              const toolCall = delta?.tool_calls?.[0];
              const content = delta?.content;
              const chunkId = parsed.id || currentMessageId || currentToolCallId;
              if (mode === "message" && toolCall?.id) {
                mode = null;
                eventStream$.sendTextMessageEnd({ messageId: currentMessageId });
              } else if (mode === "function" && (toolCall === undefined || toolCall?.id)) {
                mode = null;
                eventStream$.sendActionExecutionEnd({ actionExecutionId: currentToolCallId });
              }

              if (mode === null) {
                if (toolCall?.id) {
                  mode = "function";
                  currentToolCallId = toolCall.id;
                  eventStream$.sendActionExecutionStart({
                    actionExecutionId: currentToolCallId,
                    parentMessageId: chunkId,
                    actionName: toolCall.function?.name ?? "",
                  });
                } else if (content) {
                  mode = "message";
                  currentMessageId = chunkId;
                  contentBuffer = "";
                  eventStream$.sendTextMessageStart({ messageId: currentMessageId });
                }
              }

              if (mode === "message" && content) {
                contentBuffer += content;
                eventStream$.sendTextMessageContent({ messageId: currentMessageId, content });

                // Check if content buffer contains a JSON tool call (model outputs tool call as text)
                const toolMatch = contentBuffer.match(/\{"name"\s*:\s*"(addToCart|removeFromCart|showCart|clearCart)"\s*,\s*"parameters"\s*:\s*(\{[^}]+\})\s*\}/);
                if (toolMatch) {
                  const toolName = toolMatch[1];
                  let toolArgs: any = {};
                  try {
                    toolArgs = JSON.parse(toolMatch[2]);
                  } catch {}

                  // End current text message
                  mode = null;
                  eventStream$.sendTextMessageEnd({ messageId: currentMessageId });

                  // Start action execution
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
              } else if (mode === "function" && toolCall?.function?.arguments) {
                eventStream$.sendActionExecutionArgs({
                  actionExecutionId: currentToolCallId,
                  args: toolCall.function.arguments,
                });
              }
            }

            if (streamDone) break;
          }

          if (mode === "message") {
            eventStream$.sendTextMessageEnd({ messageId: currentMessageId });
          } else if (mode === "function") {
            eventStream$.sendActionExecutionEnd({
              actionExecutionId: currentToolCallId,
            });
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
