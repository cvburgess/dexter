import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react-native";
import { Session } from "@supabase/supabase-js";
import { ReactNode } from "react";

import AppLayout from "@/app/(app)/_layout";
import AuthLayout from "@/app/(auth)/_layout";
import AuthCallback from "@/app/auth-callback";
import Index from "@/app/index";
import { getGoals } from "@/api/goals";
import { getLists } from "@/api/lists";
import { useAuth } from "@/hooks/useAuth";
import { settleQueries } from "@/testUtils/settleQueries";
import { setPendingOAuthAuthorizationId } from "@/utils/oauthReturn";

jest.mock("@/hooks/useAuth", () => ({
  // AppLayout now mounts useRealtimeInvalidation, which calls these when
  // signed in.
  supabase: {
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    })),
    removeChannel: jest.fn(),
  },
  useAuth: jest.fn(),
}));
jest.mock("@/api/lists", () => ({ getLists: jest.fn() }));
jest.mock("@/api/goals", () => ({ getGoals: jest.fn() }));

const mockGetLists = getLists as jest.MockedFunction<typeof getLists>;
const mockGetGoals = getGoals as jest.MockedFunction<typeof getGoals>;

jest.mock("@/components/LoadingScreen", () => {
  const { Text } = require("react-native");
  return {
    LoadingScreen: () => <Text>loading</Text>,
  };
});

type Href =
  string | { pathname: string; params?: Record<string, string | undefined> };

jest.mock("expo-router", () => {
  const { Text } = require("react-native");
  const Redirect = ({ href }: { href: Href }) => {
    const label =
      typeof href === "string"
        ? href
        : `${href.pathname}?authorization_id=${href.params?.authorization_id ?? ""}`;
    return <Text>{`redirect:${label}`}</Text>;
  };
  const Stack = ({ children }: { children?: React.ReactNode }) => (
    <Text>stack{children}</Text>
  );
  Stack.Screen = function StackScreen() {
    return null;
  };
  return { Redirect, Stack };
});

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const session = { user: { id: "user-1" } } as Session;

const authStates = {
  initializing: { initializing: true, session: null },
  signedOut: { initializing: false, session: null },
  signedIn: { initializing: false, session, userId: "user-1" },
};

describe("auth guards", () => {
  describe("Index (app/index.tsx)", () => {
    it("shows the loading screen while initializing", () => {
      mockUseAuth.mockReturnValue(authStates.initializing);
      expect(render(<Index />).getByText("loading")).toBeTruthy();
    });

    it("redirects signed-out users to login", () => {
      mockUseAuth.mockReturnValue(authStates.signedOut);
      expect(
        render(<Index />).getByText("redirect:/(auth)/login"),
      ).toBeTruthy();
    });

    it("redirects signed-in users to today", () => {
      mockUseAuth.mockReturnValue(authStates.signedIn);
      expect(
        render(<Index />).getByText("redirect:/(app)/(tabs)/today"),
      ).toBeTruthy();
    });
  });

  describe("AppLayout ((app)/_layout.tsx)", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      // Every signed-in render fires the prefetch effect; resolve it by
      // default or React Query logs "data cannot be undefined".
      mockGetLists.mockResolvedValue([]);
      mockGetGoals.mockResolvedValue([]);
    });

    // AppLayout's prefetch needs a real provider; rerender reuses the SAME
    // client so auth transitions can be observed against it.
    const renderWithQueryClient = (ui: ReactNode) => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrap = (inner: ReactNode) => (
        <QueryClientProvider client={queryClient}>{inner}</QueryClientProvider>
      );
      const result = render(wrap(ui));
      return {
        ...result,
        queryClient,
        rerender: (nextUi: ReactNode) => result.rerender(wrap(nextUi)),
      };
    };

    it("shows the loading screen while initializing", () => {
      mockUseAuth.mockReturnValue(authStates.initializing);
      expect(
        renderWithQueryClient(<AppLayout />).getByText("loading"),
      ).toBeTruthy();
    });

    it("redirects signed-out users to login", () => {
      mockUseAuth.mockReturnValue(authStates.signedOut);
      expect(
        renderWithQueryClient(<AppLayout />).getByText(
          "redirect:/(auth)/login",
        ),
      ).toBeTruthy();
    });

    it("renders the authenticated stack for signed-in users", async () => {
      mockUseAuth.mockReturnValue(authStates.signedIn);
      const screen = renderWithQueryClient(<AppLayout />);

      expect(screen.getByText("stack")).toBeTruthy();
      // A signed-in mount also kicks off the prefetch below, which this test
      // has no interest in but still has to see through (DEX-130).
      await settleQueries(screen.queryClient);
    });

    it("prefetches lists and goals once a session exists", async () => {
      mockUseAuth.mockReturnValue(authStates.signedIn);

      const screen = renderWithQueryClient(<AppLayout />);

      await waitFor(() => expect(mockGetLists).toHaveBeenCalled());
      await waitFor(() => expect(mockGetGoals).toHaveBeenCalled());
      // Both calls are still in flight at that point — let them land, or the
      // layout re-renders after the test returns (DEX-130).
      await settleQueries(screen.queryClient);
    });

    it("does not prefetch while signed out", () => {
      mockUseAuth.mockReturnValue(authStates.signedOut);

      renderWithQueryClient(<AppLayout />);

      expect(mockGetLists).not.toHaveBeenCalled();
      expect(mockGetGoals).not.toHaveBeenCalled();
    });

    it("does not re-prefetch for a new session object belonging to the same user", async () => {
      mockUseAuth.mockReturnValue(authStates.signedIn);
      const screen = renderWithQueryClient(<AppLayout />);
      await waitFor(() => expect(mockGetLists).toHaveBeenCalledTimes(1));

      // A token refresh reissues a new Session object for the same user; the
      // effect must key on userId or every refresh refires the prefetch.
      mockUseAuth.mockReturnValue({
        initializing: false,
        session: { user: { id: "user-1" } } as Session,
        userId: "user-1",
      });
      screen.rerender(<AppLayout />);
      await settleQueries(screen.queryClient);

      expect(mockGetLists).toHaveBeenCalledTimes(1);
      expect(mockGetGoals).toHaveBeenCalledTimes(1);
    });

    it("clears the whole cache when a session ends outside the explicit log-out flow", async () => {
      mockUseAuth.mockReturnValue(authStates.signedIn);
      const screen = renderWithQueryClient(<AppLayout />);
      await waitFor(() =>
        expect(screen.queryClient.getQueryData(["lists"])).toEqual([]),
      );
      // A domain unrelated to the prefetch effect (e.g. tasks) — proves the
      // whole cache is cleared, not just what this effect itself warmed.
      screen.queryClient.setQueryData(["tasks"], []);

      // Revoked token / "sign out everywhere" — not the account log-out, which
      // clears itself. Without this, the next user sees stale data (DEX-36).
      mockUseAuth.mockReturnValue(authStates.signedOut);
      screen.rerender(<AppLayout />);

      expect(screen.queryClient.getQueryData(["lists"])).toBeUndefined();
      expect(screen.queryClient.getQueryData(["goals"])).toBeUndefined();
      expect(screen.queryClient.getQueryData(["tasks"])).toBeUndefined();
    });
  });

  describe("AuthLayout ((auth)/_layout.tsx)", () => {
    beforeEach(async () => {
      await AsyncStorage.clear();
    });

    it("redirects signed-in users into the app", async () => {
      mockUseAuth.mockReturnValue(authStates.signedIn);
      expect(
        await render(<AuthLayout />).findByText("redirect:/(app)/(tabs)/today"),
      ).toBeTruthy();
    });

    it("returns signed-in users to a pending OAuth consent", async () => {
      // Covers native Google sign-in, which lands the session on the login
      // screen rather than routing through auth-callback.
      await setPendingOAuthAuthorizationId("auth-123");
      mockUseAuth.mockReturnValue(authStates.signedIn);
      expect(
        await render(<AuthLayout />).findByText(
          "redirect:/oauth/consent?authorization_id=auth-123",
        ),
      ).toBeTruthy();
    });

    it("renders the auth stack for signed-out users", () => {
      mockUseAuth.mockReturnValue(authStates.signedOut);
      expect(render(<AuthLayout />).getByText("stack")).toBeTruthy();
    });

    it("renders the auth stack while initializing", () => {
      mockUseAuth.mockReturnValue(authStates.initializing);
      expect(render(<AuthLayout />).getByText("stack")).toBeTruthy();
    });
  });

  describe("AuthCallback (app/auth-callback.tsx)", () => {
    beforeEach(async () => {
      await AsyncStorage.clear();
    });

    it("shows the loading screen while initializing", () => {
      mockUseAuth.mockReturnValue(authStates.initializing);
      expect(render(<AuthCallback />).getByText("loading")).toBeTruthy();
    });

    it("redirects signed-in users to today", async () => {
      mockUseAuth.mockReturnValue(authStates.signedIn);
      expect(
        await render(<AuthCallback />).findByText(
          "redirect:/(app)/(tabs)/today",
        ),
      ).toBeTruthy();
    });

    it("returns signed-in users to a pending OAuth consent", async () => {
      await setPendingOAuthAuthorizationId("auth-123");
      mockUseAuth.mockReturnValue(authStates.signedIn);
      expect(
        await render(<AuthCallback />).findByText(
          "redirect:/oauth/consent?authorization_id=auth-123",
        ),
      ).toBeTruthy();
      // Consumed once, so a later sign-in is not hijacked by the stale id.
      expect(
        await AsyncStorage.getItem("dexter-pending-oauth-authorization-id"),
      ).toBeNull();
    });

    it("falls back to login when there is no session", () => {
      mockUseAuth.mockReturnValue(authStates.signedOut);
      expect(
        render(<AuthCallback />).getByText("redirect:/(auth)/login"),
      ).toBeTruthy();
    });
  });
});
