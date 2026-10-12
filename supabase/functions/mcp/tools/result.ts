import type { CallToolResult } from "@modelcontextprotocol/server";

export function jsonResult(value: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value) ?? "null" }],
    structuredContent: value ?? null,
  };
}

export function runtimeErrorResult(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}
