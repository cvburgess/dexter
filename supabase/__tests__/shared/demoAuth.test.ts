import { assert, assertEquals, assertNotEquals } from "@std/assert";

import {
  DEMO_EMAIL,
  deriveDemoPassword,
  isDemoEmail,
} from "../../functions/_shared/demoAuth.ts";

Deno.test("isDemoEmail matches the demo address exactly, ignoring case/space", () => {
  assert(isDemoEmail(DEMO_EMAIL));
  assert(isDemoEmail("  Demo@Dexterplanner.COM  "));
});

Deno.test("isDemoEmail rejects anything but the exact demo address", () => {
  // A whole-domain match would be dangerous — a real user must never route
  // through the demo bypass.
  assert(!isDemoEmail("user@dexterplanner.com"));
  assert(!isDemoEmail("demo@dexterplanner.com.evil.com"));
  assert(!isDemoEmail("demo@example.com"));
  assert(!isDemoEmail(""));
});

Deno.test("deriveDemoPassword is deterministic and OTP-specific", () => {
  assertEquals(deriveDemoPassword("123456"), deriveDemoPassword("123456"));
  assertNotEquals(deriveDemoPassword("123456"), deriveDemoPassword("654321"));
  assert(deriveDemoPassword("123456").includes("123456"));
});

Deno.test("deriveDemoPassword clears Supabase's password-strength floor", () => {
  const password = deriveDemoPassword("123456");
  assert(password.length >= 8);
  assert(/[a-z]/.test(password), "has lowercase");
  assert(/[A-Z]/.test(password), "has uppercase");
  assert(/[0-9]/.test(password), "has a digit");
  assert(/[^A-Za-z0-9]/.test(password), "has a symbol");
});
