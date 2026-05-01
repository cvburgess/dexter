import "@supabase/functions-js/edge-runtime.d.ts";

import { validateBearerToken } from "./auth.ts";
import { isOriginAllowed } from "./origin.ts";
import { createMcpServer } from "./server.ts";
import { WebTransport } from "./transport.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200, headers = corsHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function protectedResourceMetadataUrl(req: Request): string {
  const publicOrigin = new URL(req.url).origin.replace(/^http:/, "https:");
  return `${publicOrigin}/functions/v1/mcp-server/.well-known/oauth-protected-resource`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!isOriginAllowed(req.headers.get("origin"))) {
    return jsonResponse({ error: "Origin not allowed" }, 403);
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    const subPath = url.pathname.replace(
      /^(\/functions\/v1)?\/mcp-server/,
      "",
    );
    const publicOrigin = url.origin.replace(/^http:/, "https:");

    if (subPath === "/.well-known/oauth-protected-resource") {
      return jsonResponse({
        resource: `${publicOrigin}/functions/v1/mcp-server`,
        authorization_servers: [`${publicOrigin}/auth/v1`],
        bearer_methods_supported: ["header"],
      });
    }

    return jsonResponse({
      name: "dexter",
      version: "1.0.0",
      description:
        "Manage Dexter planning data including tasks, goals, lists, habits, days, templates, and preferences.",
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const auth = await validateBearerToken(req);
    if (!auth.ok) {
      return jsonResponse(
        { error: "Unauthorized" },
        401,
        {
          ...corsHeaders,
          "WWW-Authenticate": `Bearer resource_metadata="${
            protectedResourceMetadataUrl(req)
          }"`,
        },
      );
    }

    const server = createMcpServer(auth.supabase, auth.user);
    const transport = new WebTransport();
    await server.connect(transport);

    const body = await req.json();
    const response = await transport.handleMessage(body);

    if (response === null) {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    return jsonResponse(response);
  } catch (_error) {
    return jsonResponse(
      {
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      },
      500,
    );
  }
});
