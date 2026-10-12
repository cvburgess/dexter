import type { CallToolResult } from "@modelcontextprotocol/server";

export function runtimeErrorResult(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}
