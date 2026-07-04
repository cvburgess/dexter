import AsyncStorage from "@react-native-async-storage/async-storage";
import { render } from "@testing-library/react-native";
import { Session } from "@supabase/supabase-js";

import AuthLayout from "@/app/(auth)/_layout";
import AuthCallback from "@/app/auth-callback";
import { useAuth } from "@/hooks/useAuth";
import { setPendingOAuthAuthorizationId } from "@/utils/oauthReturn";

jest.mock("@/hooks/useAuth", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/components/LoadingScreen", () => {
  const { Text } = require("react-native");
  return { LoadingScreen: () => <Text>loading</Text> };
});

// Navigation is imperative and one-way, so record every href a <Redirect> is
// rendered with — not just the final one — to catch a transient redirect to
// Today mid-transition.
const redirectHrefs: string[] = [];

type Href =
  | string
  | { pathname: string; params?: { authorization_id?: string } };

jest.mock("expo-router", () => {
  const { Text } = require("react-native");
  const Redirect = ({ href }: { href: Href }) => {
    const label =
      typeof href === "string"
        ? href
        : `${href.pathname}?authorization_id=${href.params?.authorization_id ?? ""}`;
    redirectHrefs.push(label);
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

describe("pending OAuth consent survives the initializing→signed-in transition", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    redirectHrefs.length = 0;
    await AsyncStorage.clear();
  });

  it.each([
    ["AuthCallback", AuthCallback],
    ["AuthLayout", AuthLayout],
  ])(
    "%s never redirects to Today when a consent is pending",
    async (_name, Component) => {
      await setPendingOAuthAuthorizationId("auth-1");

      // First render mid-bootstrap: the session has not landed yet.
      mockUseAuth.mockReturnValue({ initializing: true, session: null });
      const { rerender, findByText } = render(<Component />);

      // The session lands on a later render (e.g. native Google completing the
      // exchange in place).
      mockUseAuth.mockReturnValue({
        initializing: false,
        session,
        userId: "user-1",
      });
      rerender(<Component />);

      expect(
        await findByText("redirect:/oauth/consent?authorization_id=auth-1"),
      ).toBeTruthy();
      expect(redirectHrefs).not.toContain("/(app)/(tabs)/today");
    },
  );
});
