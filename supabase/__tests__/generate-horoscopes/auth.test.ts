import { assert, assertFalse } from "@std/assert";

import {
  CRON_SECRET_HEADER,
  isAuthorizedCronRequest,
} from "../../functions/generate-horoscopes/auth.ts";

// DEX-84: verify_jwt is off (see auth.ts), so this shared secret is the
// actual gate and gets the tests.

const SECRET = "a-long-random-cron-secret";

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://example.test/generate-horoscopes", {
    method: "POST",
    headers,
  });
}

Deno.test("the correct secret is accepted", () => {
  assert(
    isAuthorizedCronRequest(request({ [CRON_SECRET_HEADER]: SECRET }), SECRET),
  );
});

Deno.test("a missing header is rejected", () => {
  assertFalse(isAuthorizedCronRequest(request(), SECRET));
});

Deno.test("a wrong secret is rejected", () => {
  assertFalse(
    isAuthorizedCronRequest(request({ [CRON_SECRET_HEADER]: "nope" }), SECRET),
  );
  assertFalse(
    isAuthorizedCronRequest(
      request({ [CRON_SECRET_HEADER]: `${SECRET}x` }),
      SECRET,
    ),
    "a correct prefix must not pass",
  );
  assertFalse(
    isAuthorizedCronRequest(
      request({ [CRON_SECRET_HEADER]: SECRET.slice(0, -1) }),
      SECRET,
    ),
    "a truncated secret must not pass",
  );
});

Deno.test("an empty header is rejected even against an empty expected secret", () => {
  // index.ts refuses to run when HOROSCOPE_CRON_SECRET is unset, but if that
  // guard moved, empty-equals-empty would make the endpoint world-callable.
  assertFalse(
    isAuthorizedCronRequest(request({ [CRON_SECRET_HEADER]: "" }), ""),
  );
});

Deno.test("a bearer token is not a substitute for the header", () => {
  assertFalse(
    isAuthorizedCronRequest(
      request({ authorization: `Bearer ${SECRET}` }),
      SECRET,
    ),
    "the whole point is that a project-signed JWT does not authorize this endpoint",
  );
});
