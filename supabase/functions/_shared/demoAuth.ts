// Shared demo-account identity for the App Store reviewer / marketing login.
// Used by the `verify-demo-otp` Edge Function and the `seed-demo` script so the
// account they provision and the credentials the function accepts never drift.
//
// NOTE: the app duplicates DEMO_EMAIL / isDemoEmail in `src/hooks/useAuth.tsx`
// (it cannot import this Deno backend module); keep the value identical there.

/** The single demo account. Matched exactly — never a whole domain — so a real
 * user's login can never be routed through the demo bypass. */
export const DEMO_EMAIL = "demo@dexterplanner.com";

export function isDemoEmail(email: string): boolean {
  return email.trim().toLowerCase() === DEMO_EMAIL;
}

// The demo password is derived from the shared DEMO_OTP secret rather than
// stored on its own, so the seed script (which sets it) and the Edge Function
// (which signs in with it) stay in sync through a single secret. The mixed
// case + symbol keep it above Supabase's password-strength floor.
export function deriveDemoPassword(otp: string): string {
  return `Dexter!Demo_${otp}`;
}
