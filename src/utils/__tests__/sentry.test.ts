import { getSentryDsn } from "../sentry";

describe("getSentryDsn", () => {
  const originalDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  afterEach(() => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = originalDsn;
  });

  it("throws when the DSN is missing", () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;

    expect(() => getSentryDsn()).toThrow("Missing EXPO_PUBLIC_SENTRY_DSN");
  });

  it("returns the configured DSN", () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN =
      "https://examplePublicKey@o0.ingest.sentry.io/0";

    expect(getSentryDsn()).toBe(
      "https://examplePublicKey@o0.ingest.sentry.io/0",
    );
  });
});
