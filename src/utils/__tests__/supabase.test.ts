const mockCreateClient = jest.fn((..._args: unknown[]) => ({ auth: {} }));

jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

describe("supabase client env validation", () => {
  const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  afterEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
    jest.resetModules();
    mockCreateClient.mockClear();
  });

  it("throws when the Supabase URL is missing", () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;

    expect(() => {
      jest.isolateModules(() => {
        require("../supabase");
      });
    }).toThrow(
      "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  });

  it("throws when the publishable key is missing", () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    expect(() => {
      jest.isolateModules(() => {
        require("../supabase");
      });
    }).toThrow(
      "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  });

  it("creates the client with the configured url and publishable key", () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";

    let mod: typeof import("../supabase") | undefined;
    jest.isolateModules(() => {
      mod = require("../supabase");
    });

    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-publishable-key",
      expect.objectContaining({
        auth: expect.objectContaining({ flowType: "pkce" }),
      }),
    );
    expect(mod?.supabase).toBeDefined();
  });
});
