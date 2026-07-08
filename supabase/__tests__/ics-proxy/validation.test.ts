import { assert, assertEquals } from "@std/assert";

import {
  buildOutboundHeaders,
  checkTargetSafety,
  isBlockedHostname,
  validateIcsUrl,
} from "../../functions/ics-proxy/validation.ts";

Deno.test("validateIcsUrl accepts public https and http .ics feeds", () => {
  const result = validateIcsUrl("https://calendar.example.com/feed.ics");
  assert(result.ok);
  assertEquals(result.url.href, "https://calendar.example.com/feed.ics");

  assert(validateIcsUrl("http://calendar.example.com/feed.ics").ok);
});

Deno.test("validateIcsUrl accepts tokenized feeds with query params", () => {
  // The `.ics` check runs against the pathname, so query strings are fine.
  const result = validateIcsUrl(
    "https://calendar.example.com/private/cal.ics?token=abc123",
  );
  assert(result.ok);
});

Deno.test("validateIcsUrl rejects non-.ics pathnames", () => {
  const result = validateIcsUrl("https://calendar.example.com/feed");
  assert(!result.ok);
  assertEquals(result.status, 403);
});

Deno.test("validateIcsUrl rejects non-http(s) schemes", () => {
  for (
    const raw of [
      "file:///etc/passwd.ics",
      "ftp://example.com/feed.ics",
      "gopher://example.com/feed.ics",
    ]
  ) {
    const result = validateIcsUrl(raw);
    assert(!result.ok, `expected ${raw} to be rejected`);
    assertEquals(result.status, 400);
  }
});

Deno.test("validateIcsUrl rejects embedded credentials", () => {
  const result = validateIcsUrl("https://user:pass@example.com/feed.ics");
  assert(!result.ok);
  assertEquals(result.status, 400);
});

Deno.test("validateIcsUrl rejects malformed URLs", () => {
  const result = validateIcsUrl("not a url");
  assert(!result.ok);
  assertEquals(result.status, 400);
});

Deno.test("validateIcsUrl blocks private, loopback, and link-local targets", () => {
  for (
    const raw of [
      "http://localhost/feed.ics",
      "http://sub.localhost/feed.ics",
      "http://127.0.0.1/feed.ics",
      "http://10.0.0.1/feed.ics",
      "http://172.16.0.1/feed.ics",
      "http://192.168.1.1/feed.ics",
      "http://169.254.169.254/feed.ics",
      "http://100.64.0.1/feed.ics",
      "http://0.0.0.0/feed.ics",
      "http://[::1]/feed.ics",
      "http://[fd00::1]/feed.ics",
      "http://[fe80::1]/feed.ics",
      "http://[::ffff:127.0.0.1]/feed.ics",
    ]
  ) {
    const result = validateIcsUrl(raw);
    assert(!result.ok, `expected ${raw} to be blocked`);
    assertEquals(result.status, 403);
  }
});

Deno.test("isBlockedHostname allows public hosts", () => {
  assertEquals(isBlockedHostname("calendar.google.com"), false);
  assertEquals(isBlockedHostname("8.8.8.8"), false);
  assertEquals(isBlockedHostname("172.15.0.1"), false); // just outside 172.16/12
  assertEquals(isBlockedHostname("172.32.0.1"), false); // just outside 172.16/12
});

Deno.test("checkTargetSafety re-validates redirect hops", () => {
  // A public https hop is allowed...
  assertEquals(checkTargetSafety(new URL("https://example.com/x")), null);
  // ...but a redirect into a private host is rejected.
  const unsafe = checkTargetSafety(new URL("http://169.254.169.254/latest"));
  assert(unsafe !== null);
  assertEquals(unsafe.status, 403);
});

Deno.test("buildOutboundHeaders never forwards caller credentials", () => {
  const headers = buildOutboundHeaders();
  assertEquals(headers.get("authorization"), null);
  assertEquals(headers.get("cookie"), null);
  assertEquals(headers.get("apikey"), null);
  assertEquals(headers.get("x-client-info"), null);
  assert(headers.has("accept"));
});
