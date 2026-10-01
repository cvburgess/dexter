import "@supabase/functions-js/edge-runtime.d.ts";

import { validateBearerToken } from "./auth.ts";
import { isOriginAllowed } from "./origin.ts";
import { createMcpServer } from "./server.ts";
import { WebTransport } from "./transport.ts";
import { captureException, withSentry } from "../_shared/sentry.ts";

const BASE_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Echo the request origin only when allowlisted. Non-browser clients send no
// Origin header (and ignore CORS); nothing here grants cookie credentials.
function corsHeaders(origin: string | null): Record<string, string> {
  const headers = { ...BASE_CORS_HEADERS };
  if (origin !== null && isOriginAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function jsonResponse(
  body: unknown,
  status = 200,
  cors: Record<string, string> = corsHeaders(null),
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function protectedResourceMetadataUrl(req: Request): string {
  try {
    const publicOrigin = new URL(req.url).origin.replace(/^http:/, "https:");
    return `${publicOrigin}/functions/v1/mcp-server/.well-known/oauth-protected-resource`;
  } catch {
    return "";
  }
}

Deno.serve(withSentry(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (!isOriginAllowed(origin)) {
    return jsonResponse({ error: "Origin not allowed" }, 403, cors);
  }

  if (req.method === "GET") {
    try {
      const url = new URL(req.url);
      const subPath = url.pathname.replace(
        /^(\/functions\/v1)?\/mcp-server/,
        "",
      );
      const publicOrigin = url.origin.replace(/^http:/, "https:");

      if (subPath === "/.well-known/oauth-protected-resource") {
        return jsonResponse(
          {
            resource: `${publicOrigin}/functions/v1/mcp-server`,
            // GoTrue's OAuth issuer is always the raw project URL, even behind a
            // custom domain — and the /auth/v1 path is required for discovery.
            authorization_servers: [
              `${Deno.env.get("SUPABASE_URL") ?? publicOrigin}/auth/v1`,
            ],
            bearer_methods_supported: ["header"],
          },
          200,
          cors,
        );
      }

      return jsonResponse(
        {
          name: "dexter",
          version: "1.0.0",
          description:
            "Manage Dexter planning data including tasks, goals, lists, habits, notes, journals, templates, and preferences.",
        },
        200,
        cors,
      );
    } catch {
      return jsonResponse({ error: "Invalid request URL" }, 400, cors);
    }
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, cors);
  }

  try {
    const auth = await validateBearerToken(req);
    if (!auth.ok) {
      return jsonResponse(
        { error: "Unauthorized" },
        401,
        {
          ...cors,
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
      return new Response(null, { status: 204, headers: cors });
    }

    return jsonResponse(response, 200, cors);
  } catch (error) {
    captureException(error);
    return jsonResponse(
      {
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      },
      500,
      cors,
    );
  }
}));
