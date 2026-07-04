import AsyncStorage from "@react-native-async-storage/async-storage";
import { render } from "@testing-library/react-native";
import { Session } from "@supabase/supabase-js";

import AppLayout from "@/app/(app)/_layout";
import AuthLayout from "@/app/(auth)/_layout";
import AuthCallback from "@/app/auth-callback";
import Index from "@/app/index";
import { useAuth } from "@/hooks/useAuth";
import { setPendingOAuthAuthorizationId } from "@/utils/oauthReturn";

jest.mock("@/hooks/useAuth", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/components/LoadingScreen", () => {
  const { Text } = require("react-native");
  return {
    LoadingScreen: () => <Text>loading</Text>,
  };
});

type Href =
  | string
  | { pathname: string; params?: Record<string, string | undefined> };

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
  Stack.Screen = () => null;
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
    it("shows the loading screen while initializing", () => {
      mockUseAuth.mockReturnValue(authStates.initializing);
      expect(render(<AppLayout />).getByText("loading")).toBeTruthy();
    });

    it("redirects signed-out users to login", () => {
      mockUseAuth.mockReturnValue(authStates.signedOut);
      expect(
        render(<AppLayout />).getByText("redirect:/(auth)/login"),
      ).toBeTruthy();
    });

    it("renders the authenticated stack for signed-in users", () => {
      mockUseAuth.mockReturnValue(authStates.signedIn);
      expect(render(<AppLayout />).getByText("stack")).toBeTruthy();
    });
  });

  describe("AuthLayout ((auth)/_layout.tsx)", () => {
    it("redirects signed-in users into the app", () => {
      mockUseAuth.mockReturnValue(authStates.signedIn);
      expect(
        render(<AuthLayout />).getByText("redirect:/(app)/(tabs)/today"),
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
