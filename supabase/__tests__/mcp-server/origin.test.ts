import { assertEquals } from "@std/assert";

import { isOriginAllowed } from "../../functions/mcp-server/origin.ts";

Deno.test("isOriginAllowed allows desktop clients without Origin", () => {
  assertEquals(isOriginAllowed(null), true);
  assertEquals(isOriginAllowed(undefined), true);
  assertEquals(isOriginAllowed(""), true);
});

Deno.test("isOriginAllowed allows trusted browser origins", () => {
  assertEquals(isOriginAllowed("http://localhost:8081"), true);
  assertEquals(isOriginAllowed("https://dexterplanner.com"), true);
  assertEquals(isOriginAllowed("https://app.dexterplanner.com"), true);
  assertEquals(isOriginAllowed("https://app.magicmealkit.com"), true);
  assertEquals(isOriginAllowed("https://claude.ai"), true);
  assertEquals(isOriginAllowed("https://project.cursor.com"), true);
});

Deno.test("isOriginAllowed rejects invalid or blocked origins", () => {
  assertEquals(isOriginAllowed("not a url"), false);
  assertEquals(isOriginAllowed("https://evil.example.com"), false);
  assertEquals(isOriginAllowed("https://dexterplanner.com.evil.test"), false);
});
