// DEX-84: `verify_jwt` is off (config.toml) — not a real gate — so the
// caller is authenticated here against a shared secret from Vault.

import { timingSafeEqual } from "@std/crypto/timing-safe-equal";

export const CRON_SECRET_HEADER = "x-cron-secret";

const encoder = new TextEncoder();

// Compared in constant time: `===` on strings short-circuits at the first
// differing byte, leaking the secret one character at a time to a timer.
export function isAuthorizedCronRequest(
  req: Request,
  expectedSecret: string,
): boolean {
  const provided = req.headers.get(CRON_SECRET_HEADER);
  if (!provided) return false;

  const providedBytes = encoder.encode(provided);
  const expectedBytes = encoder.encode(expectedSecret);

  // NOT redundant: `timingSafeEqual` throws on length mismatch on the deployed
  // edge runtime, turning a wrong-length secret into a length-oracle 500.
  if (providedBytes.byteLength !== expectedBytes.byteLength) return false;

  return timingSafeEqual(providedBytes, expectedBytes);
}
