// The DSN is public (safe in the bundle) but Sentry.init still needs one —
// fail fast rather than silently run without error reporting.
export const getSentryDsn = (): string => {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    throw new Error("Missing EXPO_PUBLIC_SENTRY_DSN");
  }

  return dsn;
};
