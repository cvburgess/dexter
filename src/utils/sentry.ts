// The DSN is a public identifier (safe to ship in the client bundle — it is
// not a secret), but Sentry.init still needs a value to be useful. Fail fast
// with a clear message rather than silently running without error reporting,
// mirroring the env validation in utils/supabase.ts.
export const getSentryDsn = (): string => {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    throw new Error("Missing EXPO_PUBLIC_SENTRY_DSN");
  }

  return dsn;
};
