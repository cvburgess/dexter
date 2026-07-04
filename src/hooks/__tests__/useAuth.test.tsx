import AsyncStorage from "@react-native-async-storage/async-storage";
import { Session } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import {
  AuthProvider,
  signInWithEmail,
  signInWithGoogle,
  useAuth,
} from "../useAuth";

const mockGetSession = jest.fn();
const mockExchangeCodeForSession = jest.fn();
const mockSignInWithOAuth = jest.fn();
const mockSignInWithOtp = jest.fn();
const mockUnsubscribe = jest.fn();

type AuthStateCallback = (event: string, session: Session | null) => void;
let authStateCallback: AuthStateCallback | undefined;

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (callback: AuthStateCallback) => {
        authStateCallback = callback;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      },
      exchangeCodeForSession: (...args: unknown[]) =>
        mockExchangeCodeForSession(...args),
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
      signInWithOtp: (...args: unknown[]) => mockSignInWithOtp(...args),
      signOut: jest.fn(),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
      updateUser: jest.fn(),
    },
    rpc: jest.fn(),
  })),
}));

jest.mock("expo-linking", () => ({
  createURL: jest.fn(() => "dexter://auth-callback"),
  parse: jest.fn((url: string) => {
    const queryString = url.split("?")[1] ?? "";
    return {
      queryParams: Object.fromEntries(new URLSearchParams(queryString)),
    };
  }),
  getInitialURL: jest.fn(async () => null),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock("expo-web-browser", () => ({
  openAuthSessionAsync: jest.fn(),
}));

const mockOpenAuthSessionAsync =
  WebBrowser.openAuthSessionAsync as jest.MockedFunction<
    typeof WebBrowser.openAuthSessionAsync
  >;

const validSession = {
  access_token: "access-token",
  refresh_token: "refresh-token",
  user: { id: "user-1" },
} as Session;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe("AuthProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authStateCallback = undefined;
    void AsyncStorage.clear();
  });

  it("bootstraps the persisted session", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: validSession },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.initializing).toBe(false);
    });
    expect(result.current.session).toBe(validSession);
    expect(result.current.userId).toBe("user-1");
  });

  it("clears corrupted auth storage on an invalid refresh token", async () => {
    await AsyncStorage.setItem("sb-test-auth-token", "corrupted");
    await AsyncStorage.setItem("sb-test-auth-token-code-verifier", "verifier");
    await AsyncStorage.setItem("unrelated-key", "keep-me");
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: new Error("Invalid Refresh Token: Refresh Token Not Found"),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.initializing).toBe(false);
    });
    expect(result.current.session).toBeNull();
    expect(await AsyncStorage.getItem("sb-test-auth-token")).toBeNull();
    // The PKCE code verifier must survive so a concurrent callback exchange
    // still works.
    expect(await AsyncStorage.getItem("sb-test-auth-token-code-verifier")).toBe(
      "verifier",
    );
    expect(await AsyncStorage.getItem("unrelated-key")).toBe("keep-me");
  });

  it("updates the session when auth state changes", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.initializing).toBe(false);
    });
    expect(result.current.session).toBeNull();

    act(() => {
      authStateCallback?.("SIGNED_IN", validSession);
    });

    expect(result.current.session).toBe(validSession);
  });
});

describe("signInWithEmail", () => {
  it("sends a magic link that redirects to the auth callback", async () => {
    mockSignInWithOtp.mockResolvedValue({ data: {}, error: null });

    await signInWithEmail("user@example.com");

    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      options: { emailRedirectTo: "dexter://auth-callback" },
    });
  });
});

describe("signInWithGoogle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("opens a browser auth session and exchanges the returned code", async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: "https://accounts.google.com/authorize" },
      error: null,
    });
    mockOpenAuthSessionAsync.mockResolvedValue({
      type: "success",
      url: "dexter://auth-callback?code=auth-code",
    });
    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: validSession },
      error: null,
    });

    await signInWithGoogle();

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "dexter://auth-callback",
        skipBrowserRedirect: true,
      },
    });
    expect(mockOpenAuthSessionAsync).toHaveBeenCalledWith(
      "https://accounts.google.com/authorize",
      "dexter://auth-callback",
    );
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("auth-code");
  });

  it("does not open a browser session when the OAuth request fails", async () => {
    const error = new Error("provider unavailable");
    mockSignInWithOAuth.mockResolvedValue({ data: { url: null }, error });

    const result = await signInWithGoogle();

    expect(result.error).toBe(error);
    expect(mockOpenAuthSessionAsync).not.toHaveBeenCalled();
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("does not exchange a code when the user cancels", async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: "https://accounts.google.com/authorize" },
      error: null,
    });
    mockOpenAuthSessionAsync.mockResolvedValue({
      type: "cancel",
    } as Awaited<ReturnType<typeof WebBrowser.openAuthSessionAsync>>);

    await signInWithGoogle();

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });
});
