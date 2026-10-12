import { assertEquals } from "@std/assert";
import { SignJWT } from "jose";

import { validateBearerToken } from "../../functions/mcp-server/auth.ts";

// DEX-228: the sibling endpoint must not remove legacy-token support here.
Deno.test("validateBearerToken still delegates legacy HS256 tokens to getUser", async () => {
  const bearer = await new SignJWT({ role: "authenticated" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("00000000-0000-4000-8000-000000000001")
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode("legacy-test-secret-at-least-32-bytes"));
  const previousUrl = Deno.env.get("SUPABASE_URL");
  const previousKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  let receivedAuthorization: string | null = null;
  const server = Deno.serve(
    { port: 0, hostname: "127.0.0.1", onListen: () => {} },
    (req) => {
      receivedAuthorization = req.headers.get("Authorization");
      return Response.json({ id: "00000000-0000-4000-8000-000000000001" });
    },
  );
  try {
    const { port } = server.addr as Deno.NetAddr;
    Deno.env.set("SUPABASE_URL", `http://127.0.0.1:${port}`);
    Deno.env.set("SUPABASE_PUBLISHABLE_KEYS", '{"default":"publishable-key"}');
    const result = await validateBearerToken(
      new Request("http://localhost", {
        headers: { Authorization: `Bearer ${bearer}` },
      }),
    );
    assertEquals(result.ok, true);
    assertEquals(receivedAuthorization, `Bearer ${bearer}`);
  } finally {
    await server.shutdown();
    restoreEnv("SUPABASE_URL", previousUrl);
    restoreEnv("SUPABASE_PUBLISHABLE_KEYS", previousKeys);
  }
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    Deno.env.delete(name);
  } else {
    Deno.env.set(name, value);
  }
}

Deno.test("validateBearerToken rejects missing Authorization header", async () => {
  const result = await validateBearerToken(new Request("http://localhost"));

  assertEquals(result.ok, false);
});

Deno.test("validateBearerToken rejects invalid bearer tokens", async () => {
  const previousUrl = Deno.env.get("SUPABASE_URL");
  const previousPublishableKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");

  const server = Deno.serve(
    { port: 0, hostname: "127.0.0.1", onListen: () => {} },
    () =>
      new Response(JSON.stringify({ error: "invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
  );

  try {
    const { port } = server.addr as Deno.NetAddr;
    Deno.env.set("SUPABASE_URL", `http://127.0.0.1:${port}`);
    Deno.env.set("SUPABASE_PUBLISHABLE_KEYS", '{"default":"publishable-key"}');

    const result = await validateBearerToken(
      new Request("http://localhost", {
        headers: { Authorization: "Bearer invalid-token" },
      }),
    );

    assertEquals(result.ok, false);
  } finally {
    await server.shutdown();
    restoreEnv("SUPABASE_URL", previousUrl);
    restoreEnv("SUPABASE_PUBLISHABLE_KEYS", previousPublishableKeys);
  }
});
