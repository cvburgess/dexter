import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import {
  fromSupabaseUrl,
  type SupabaseContext,
  type SupabaseEnv,
  withOAuthProtectedResource,
  withSupabase,
} from "@supabase/server";

import type { Database } from "@src/types/database.types.ts";
import { isOriginAllowed } from "./origin.ts";
import { captureException, withSentry } from "../_shared/sentry.ts";
import { registerTools, type ToolContext } from "./tools/index.ts";

export function createServer(context: ToolContext): McpServer {
  const server = new McpServer(
    { name: "dexter", version: "1.0.0" },
    {
      instructions:
        "Manage Dexter planning data including tasks, goals, lists, habits, notes, journals, templates, and preferences." +
        " Every tool runs as the signed-in user; Row Level Security applies. " +
        "Read each tool's description and annotations before calling it.",
    },
  );
  registerTools(server, context);
  return server;
}

function handleMcp(
  request: Request,
  ctx: SupabaseContext<Database>,
): Promise<Response> {
  const handler = createMcpHandler(
    () =>
      createServer({
        supabase: ctx.supabase,
        userId: ctx.userClaims!.id,
      }),
    { onerror: captureException },
  );
  return handler.fetch(request);
}

export function createHandler(
  env?: Partial<SupabaseEnv>,
): (request: Request) => Promise<Response> {
  const projectUrl = env?.url ?? Deno.env.get("SUPABASE_URL");
  const issuer = projectUrl ? fromSupabaseUrl(projectUrl) : undefined;
  const handler = withOAuthProtectedResource(
    // DEX-225: GoTrue's issuer remains the raw project URL behind a custom domain.
    { authorizationServer: issuer },
    withSupabase<Database>(
      {
        auth: "user",
        cors: "disabled",
        env,
        issuer,
        audience: "authenticated",
      },
      handleMcp,
    ),
  );

  return withSentry(async (request) => {
    const origin = request.headers.get("origin");
    if (!isOriginAllowed(origin)) {
      return Response.json({ error: "Origin not allowed" }, { status: 403 });
    }

    const response = request.method === "OPTIONS"
      ? new Response(null, { status: 204 })
      : await handler(request);
    const headers = new Headers(response.headers);
    headers.delete("Access-Control-Allow-Origin");
    if (origin) headers.set("Access-Control-Allow-Origin", origin);
    headers.append("Vary", "Origin");
    headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    headers.set(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Mcp-Method, Mcp-Name",
    );
    headers.set(
      "Access-Control-Expose-Headers",
      "WWW-Authenticate, Mcp-Session-Id",
    );
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  });
}
