import {
  type CallToolResult,
  createMcpHandler,
  type Tool,
} from "@modelcontextprotocol/server";
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

import type { Database } from "@src/types/database.types.ts";
import { createServer } from "../../functions/mcp/handler.ts";
import { createMcpServer } from "../../functions/mcp-server/server.ts";
import { WebTransport } from "../../functions/mcp-server/transport.ts";

const USER = "00000000-0000-4000-8000-000000000001";
const TASK = "00000000-0000-4000-8000-000000000002";

type FetchCall = { url: URL; init: RequestInit };

function fixture() {
  const calls: FetchCall[] = [];
  let error = false;
  const supabase = createClient<Database>(
    "https://project.supabase.co",
    "sb_publishable_test",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: { Authorization: "Bearer verified-user-token" },
        fetch: (input, init = {}) => {
          const url = new URL(String(input));
          calls.push({ url, init });
          if (error) {
            return Promise.resolve(
              Response.json(
                { message: "Database unavailable", code: "XX000" },
                { status: 500 },
              ),
            );
          }
          const data = init.method === "POST" && url.pathname.endsWith("/tasks")
            ? { id: TASK, ...JSON.parse(String(init.body)) }
            : [{ id: TASK, title: "Scoped task", user_id: USER }];
          return Promise.resolve(Response.json(data));
        },
      },
    },
  );
  const handler = createMcpHandler(() =>
    createServer({
      supabase,
      userClaims: { id: USER, role: "authenticated" },
      jwtClaims: {
        sub: USER,
        role: "authenticated",
        client_id: "oauth-client",
      },
    })
  );

  async function rpc<T>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    const response = await handler.fetch(
      new Request("https://api.dexterplanner.com/functions/v1/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "Mcp-Protocol-Version": "2025-06-18",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      }),
    );
    assertEquals(response.status, 200);
    const text = await response.text();
    const json =
      response.headers.get("Content-Type")?.includes("text/event-stream")
        ? text.split("\n").find((line) => line.startsWith("data:"))!.slice(5)
        : text;
    const envelope = JSON.parse(json) as { result: T; error?: unknown };
    assertEquals(envelope.error, undefined);
    return envelope.result;
  }

  return {
    supabase,
    calls,
    rpc,
    fail: () => {
      error = true;
    },
    throw: () => {
      supabase.from = () => {
        throw new Error("internal credential must not leak");
      };
    },
  };
}

Deno.test("DEX-228: v1 and v2 expose identical tool contracts and ownership-free inputs", async () => {
  const f = fixture();
  const legacy = createMcpServer(f.supabase, { id: USER } as User);
  const transport = new WebTransport();
  await legacy.connect(transport);
  try {
    const response = await transport.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    });
    assert(response && "result" in response);
    const oldTools = (response.result as { tools: Tool[] }).tools;
    const { tools } = await f.rpc<{ tools: Tool[] }>("tools/list");
    const contract = (tool: Tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      annotations: tool.annotations,
      inputSchema: Object.fromEntries(
        Object.entries(tool.inputSchema).filter(([key]) => key !== "$schema"),
      ),
    });
    assertEquals(tools.map(contract), oldTools.map(contract));
    assertEquals(tools.length, 36);
    for (const tool of tools) {
      const properties = tool.inputSchema.properties ?? {};
      assert(!("user_id" in properties), `${tool.name} exposes user_id`);
      assert(!("userId" in properties), `${tool.name} exposes userId`);
    }
    const listTasks = tools.find((tool) => tool.name === "list_tasks")!;
    const descriptions = JSON.stringify(listTasks.inputSchema);
    assertStringIncludes(descriptions, "1 here is To Do, not Urgent");
    assertStringIncludes(descriptions, "1 here is Urgent, not To Do");
  } finally {
    await legacy.close();
  }
});

Deno.test("DEX-228: list_tasks scopes the real PostgREST request and returns JSON plus structured data", async () => {
  const f = fixture();
  const result = await f.rpc<CallToolResult>("tools/call", {
    name: "list_tasks",
    arguments: {},
  });
  assertEquals(result.isError, undefined);
  const rows = [{ id: TASK, title: "Scoped task", user_id: USER }];
  // The SDK wraps arrays for 2025 clients: structuredContent must be an object.
  assertEquals(result.structuredContent, { result: rows });
  assertEquals(
    JSON.parse((result.content[0] as { text: string }).text),
    rows,
  );
  assertEquals(f.calls[0].url.searchParams.get("user_id"), `eq.${USER}`);
  assertEquals(
    new Headers(f.calls[0].init.headers).get("Authorization"),
    "Bearer verified-user-token",
  );
});

Deno.test("DEX-228: create_task ignores supplied ownership and applies transforms/defaults", async () => {
  const f = fixture();
  const result = await f.rpc<CallToolResult>("tools/call", {
    name: "create_task",
    arguments: {
      title: "New task",
      userId: "another-user",
      user_id: "another-user",
      url: "dexterplanner.com",
      subtasks: [{ id: "one", title: "First step" }],
    },
  });
  assertEquals(result.isError, undefined);
  assertEquals(result.structuredContent, {
    id: TASK,
    user_id: USER,
    title: "New task",
    due_on: null,
    goal_id: null,
    list_id: null,
    scheduled_for: null,
    subtasks: [{ id: "one", title: "First step", done: false }],
    template_id: null,
    url: "https://dexterplanner.com",
  });
});

Deno.test("DEX-228: search alone delegates ownership filtering to SECURITY INVOKER RLS", async () => {
  const f = fixture();
  const result = await f.rpc<CallToolResult>("tools/call", {
    name: "search",
    arguments: { query: "task" },
  });
  assertEquals(result.isError, undefined);
  assertEquals(f.calls[0].url.pathname, "/rest/v1/rpc/search_entries");
  assertEquals(f.calls[0].url.searchParams.get("user_id"), null);
  assertEquals(f.calls[0].url.searchParams.get("limit"), "50");
  assertEquals(
    new Headers(f.calls[0].init.headers).get("Authorization"),
    "Bearer verified-user-token",
  );
});

Deno.test("DEX-228: database failures are tool errors, thrown failures are sanitized", async () => {
  const f = fixture();
  f.fail();
  const result = await f.rpc<CallToolResult>("tools/call", {
    name: "list_tasks",
    arguments: {},
  });
  assertEquals(result.isError, true);
  assertStringIncludes(JSON.stringify(result.content), "Database unavailable");

  const thrown = fixture();
  thrown.throw();
  const sanitized = await thrown.rpc<CallToolResult>("tools/call", {
    name: "list_tasks",
    arguments: {},
  });
  assertEquals(sanitized.isError, true);
  assertStringIncludes(JSON.stringify(sanitized.content), "Unable to complete");
  assert(!JSON.stringify(sanitized).includes("internal credential"));
});
