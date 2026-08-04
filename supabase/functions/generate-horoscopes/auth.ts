// Caller authentication for DEX-84.
//
// The function gateway's `verify_jwt` is off (see config.toml). It only proves a
// bearer was signed by this project, which any signed-in user's access token
// satisfies — as does the publishable key that ships inside the app bundle. On
// an endpoint that spends paid upstream and LLM quota that is no gate at all, so
// the caller is authenticated here instead, against a dedicated shared secret
// the pg_cron job reads from Vault.

import { timingSafeEqual } from "@std/crypto/timing-safe-equal";

export const CRON_SECRET_HEADER = "x-cron-secret";

const encoder = new TextEncoder();

/**
 * Whether the request carries the expected cron secret.
 *
 * Compared in constant time: `===` on strings short-circuits at the first
 * differing byte, which leaks the secret one character at a time to a caller
 * willing to measure. `timingSafeEqual` still returns early on a length
 * mismatch, but the length of a random secret is not the part worth protecting.
 */
export function isAuthorizedCronRequest(
  req: Request,
  expectedSecret: string,
): boolean {
  const provided = req.headers.get(CRON_SECRET_HEADER);
  if (!provided) return false;

  // `timingSafeEqual` returns false on a length mismatch rather than throwing,
  // so no explicit length guard is needed.
  return timingSafeEqual(
    encoder.encode(provided),
    encoder.encode(expectedSecret),
  );
}
