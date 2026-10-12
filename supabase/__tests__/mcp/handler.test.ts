import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

import { createHandler } from "../../functions/mcp/handler.ts";

const PROJECT = "https://project.supabase.co";
const PUBLIC = "https://api.dexterplanner.com/functions/v1/mcp";
const USER = "00000000-0000-4000-8000-000000000001";
const { privateKey, publicKey } = await generateKeyPair("ES256");
const jwk = { ...await exportJWK(publicKey), kid: "test-key", alg: "ES256" };
const handler = createHandler({
  url: PROJECT,
  publishableKeys: { default: "sb_publishable_test" },
  secretKeys: {},
  jwks: { keys: [jwk] },
});

function request(
  path = "",
  init: RequestInit = {},
): Request {
  const headers = new Headers(init.headers);
  headers.set("X-Forwarded-Host", "api.dexterplanner.com");
  headers.set("X-Forwarded-Proto", "https");
  return new Request(`http://edge-runtime/mcp${path}`, { ...init, headers });
}

async function token(
  claims: Record<string, unknown> = {},
  expiration: string | number = "1h",
): Promise<string> {
  return await new SignJWT({ role: "authenticated", ...claims })
    .setProtectedHeader({ alg: "ES256", kid: "test-key" })
    .setSubject(USER)
    .setIssuer(`${PROJECT}/auth/v1`)
    .setAudience("authenticated")
    .setExpirationTime(expiration)
    .sign(privateKey);
}

Deno.test("DEX-228: unauthenticated requests advertise public OAuth discovery", async () => {
  const response = await handler(request("", { method: "POST" }));
  assertEquals(response.status, 401);
  assertEquals(
    response.headers.get("WWW-Authenticate"),
    `Bearer resource_metadata="${PUBLIC}/oauth-protected-resource"`,
  );
  await response.body?.cancel();
});

Deno.test("DEX-225: discovery keeps the public resource and raw project issuer", async () => {
  const response = await handler(request("/oauth-protected-resource", {
    headers: { Origin: "https://claude.ai" },
  }));
  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    resource: PUBLIC,
    authorization_servers: [`${PROJECT}/auth/v1`],
    bearer_methods_supported: ["header"],
  });
  assertEquals(
    response.headers.get("Access-Control-Allow-Origin"),
    "https://claude.ai",
  );
});

Deno.test("DEX-228: untrusted origins are rejected before discovery, auth, and preflight", async () => {
  for (
    const [path, method] of [
      ["", "POST"],
      ["/oauth-protected-resource", "GET"],
      ["", "OPTIONS"],
    ]
  ) {
    const response = await handler(request(path, {
      method,
      headers: { Origin: "https://claude.ai.attacker.example" },
    }));
    assertEquals(response.status, 403);
    assertEquals(response.headers.get("Access-Control-Allow-Origin"), null);
    await response.body?.cancel();
  }
});

Deno.test("DEX-228: allowed browser clients can preflight Streamable HTTP headers", async () => {
  const response = await handler(request("", {
    method: "OPTIONS",
    headers: { Origin: "https://claude.ai" },
  }));
  assertEquals(response.status, 204);
  assertEquals(
    response.headers.get("Access-Control-Allow-Origin"),
    "https://claude.ai",
  );
  assertStringIncludes(
    response.headers.get("Access-Control-Allow-Headers")!,
    "Mcp-Protocol-Version",
  );
  assertStringIncludes(
    response.headers.get("Access-Control-Expose-Headers")!,
    "WWW-Authenticate",
  );
  assertStringIncludes(response.headers.get("Vary")!, "Origin");
});

Deno.test("DEX-228: legacy HS256, expired, malformed, and foreign-issuer tokens are rejected", async () => {
  const legacy = await new SignJWT({ role: "authenticated" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(USER)
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode("legacy-test-secret-at-least-32-bytes"));
  const foreign = await new SignJWT({ role: "authenticated" })
    .setProtectedHeader({ alg: "ES256", kid: "test-key" })
    .setSubject(USER)
    .setIssuer("https://other.supabase.co/auth/v1")
    .setAudience("authenticated")
    .setExpirationTime("1h")
    .sign(privateKey);

  for (const bearer of [legacy, await token({}, 1), "invalid-token", foreign]) {
    const response = await handler(request("", {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}` },
    }));
    assertEquals(response.status, 401);
    assertStringIncludes(response.headers.get("WWW-Authenticate")!, PUBLIC);
    await response.body?.cancel();
  }
});

Deno.test("DEX-228: ES256 product and OAuth sessions reach the v2 transport without getUser", async () => {
  for (const claims of [{}, { client_id: "oauth-client" }]) {
    const response = await handler(request("", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await token(claims)}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "dexter-test", version: "1.0.0" },
        },
      }),
    }));
    assertEquals(response.status, 200);
    const body = await response.text();
    assertStringIncludes(body, '"name":"dexter"');
    assertStringIncludes(body, "Row Level Security applies");
    assert(!body.includes('"error"'));
  }
});
