// Shared by `verify-demo-otp` and `seed-demo` so credentials never drift.
// Duplicated in `src/hooks/useAuth.tsx` (can't import Deno) — keep in sync.

/** The single demo account. Matched exactly — never a whole domain — so a real
 * user's login can never be routed through the demo bypass. */
export const DEMO_EMAIL = "demo@dexterplanner.com";

export function isDemoEmail(email: string): boolean {
  return email.trim().toLowerCase() === DEMO_EMAIL;
}

// Derived rather than stored so seed-demo and verify-demo-otp stay in sync
// through one secret; mixed case + symbol clear Supabase's strength floor.
export function deriveDemoPassword(otp: string): string {
  return `Dexter!Demo_${otp}`;
}
