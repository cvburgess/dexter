import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Session } from "@supabase/supabase-js";
import { Linking } from "react-native";

import OAuthConsentScreen from "@/app/oauth/consent";
import { useAuth } from "@/hooks/useAuth";

const mockGetAuthorizationDetails = jest.fn();
const mockApproveAuthorization = jest.fn();
const mockDenyAuthorization = jest.fn();

jest.mock("@/hooks/useAuth", () => ({
  useAuth: jest.fn(),
  supabase: {
    auth: {
      oauth: {
        getAuthorizationDetails: (...args: unknown[]) =>
          mockGetAuthorizationDetails(...args),
        approveAuthorization: (...args: unknown[]) =>
          mockApproveAuthorization(...args),
        denyAuthorization: (...args: unknown[]) =>
          mockDenyAuthorization(...args),
      },
    },
  },
}));

const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: { authorization_id?: string } = {};

jest.mock("expo-router", () => {
  const { Text } = require("react-native");
  return {
    useLocalSearchParams: () => mockParams,
    useRouter: () => ({ replace: mockReplace, back: mockBack }),
    Redirect: ({ href }: { href: string | { pathname: string } }) => (
      <Text>{`redirect:${typeof href === "string" ? href : href.pathname}`}</Text>
    ),
  };
});

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const session = { user: { id: "user-1" } } as Session;
const signedIn = { initializing: false, session, userId: "user-1" };
const signedOut = { initializing: false, session: null };
const initializingState = { initializing: true, session: null };

describe("OAuthConsentScreen", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockParams = {};
    await AsyncStorage.clear();
  });

  it("shows the requesting client and Dexter's data scopes", async () => {
    mockParams = { authorization_id: "auth-1" };
    mockUseAuth.mockReturnValue(signedIn);
    mockGetAuthorizationDetails.mockResolvedValue({
      data: { client: { name: "Claude" } },
      error: null,
    });

    const { findByText } = render(<OAuthConsentScreen />);

    expect(
      await findByText(
        "Claude wants to access your tasks, lists, goals, days, habits, and journals.",
      ),
    ).toBeTruthy();
  });

  it("shows a done state when the authorization was already approved", async () => {
    mockParams = { authorization_id: "auth-1" };
    mockUseAuth.mockReturnValue(signedIn);
    mockGetAuthorizationDetails.mockResolvedValue({
      data: null,
      error: { code: "oauth_authorization_not_found" },
    });

    const { findByText } = render(<OAuthConsentScreen />);

    expect(await findByText("Authorized")).toBeTruthy();
  });

  it("follows the redirect url when consent was already granted", async () => {
    mockParams = { authorization_id: "auth-1" };
    mockUseAuth.mockReturnValue(signedIn);
    mockGetAuthorizationDetails.mockResolvedValue({
      data: { redirect_url: "https://claude.ai/api/mcp/auth_callback?code=y" },
      error: null,
    });
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);

    const { queryByTestId } = render(<OAuthConsentScreen />);

    await waitFor(() => {
      expect(openURL).toHaveBeenCalledWith(
        "https://claude.ai/api/mcp/auth_callback?code=y",
      );
    });
    // The consent UI is skipped entirely.
    expect(queryByTestId("oauth-consent-approve-button")).toBeNull();
  });

  it("redirects an authenticated visit with no authorization_id into the app", () => {
    mockParams = {};
    mockUseAuth.mockReturnValue(signedIn);

    const { getByText } = render(<OAuthConsentScreen />);

    expect(getByText("redirect:/(app)/(tabs)/today")).toBeTruthy();
  });

  it("stashes the authorization_id and redirects an unauthenticated visitor to sign-in", async () => {
    mockParams = { authorization_id: "auth-1" };
    mockUseAuth.mockReturnValue(signedOut);

    render(<OAuthConsentScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
    });
    expect(
      await AsyncStorage.getItem("dexter-pending-oauth-authorization-id"),
    ).toBe("auth-1");
    expect(mockGetAuthorizationDetails).not.toHaveBeenCalled();
  });

  it("approves the authorization and follows the redirect url", async () => {
    mockParams = { authorization_id: "auth-1" };
    mockUseAuth.mockReturnValue(signedIn);
    mockGetAuthorizationDetails.mockResolvedValue({
      data: { client: { name: "Claude" } },
      error: null,
    });
    mockApproveAuthorization.mockResolvedValue({
      data: { redirect_url: "https://claude.ai/api/mcp/auth_callback?code=x" },
      error: null,
    });
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);

    const { findByTestId } = render(<OAuthConsentScreen />);

    fireEvent.press(await findByTestId("oauth-consent-approve-button"));

    await waitFor(() => {
      expect(mockApproveAuthorization).toHaveBeenCalledWith("auth-1");
    });
    expect(openURL).toHaveBeenCalledWith(
      "https://claude.ai/api/mcp/auth_callback?code=x",
    );
  });

  it("surfaces an error when approval fails", async () => {
    mockParams = { authorization_id: "auth-1" };
    mockUseAuth.mockReturnValue(signedIn);
    mockGetAuthorizationDetails.mockResolvedValue({
      data: { client: { name: "Claude" } },
      error: null,
    });
    mockApproveAuthorization.mockResolvedValue({
      data: null,
      error: { message: "denied by policy" },
    });

    const { findByTestId, findByText } = render(<OAuthConsentScreen />);

    fireEvent.press(await findByTestId("oauth-consent-approve-button"));

    expect(await findByText("denied by policy")).toBeTruthy();
  });

  it("denies the authorization and follows the redirect url", async () => {
    mockParams = { authorization_id: "auth-1" };
    mockUseAuth.mockReturnValue(signedIn);
    mockGetAuthorizationDetails.mockResolvedValue({
      data: { client: { name: "Claude" } },
      error: null,
    });
    mockDenyAuthorization.mockResolvedValue({
      data: {
        redirect_url: "https://claude.ai/api/mcp/auth_callback?error=denied",
      },
      error: null,
    });
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);

    const { findByTestId } = render(<OAuthConsentScreen />);

    fireEvent.press(await findByTestId("oauth-consent-deny-button"));

    await waitFor(() => {
      expect(mockDenyAuthorization).toHaveBeenCalledWith("auth-1");
    });
    expect(openURL).toHaveBeenCalledWith(
      "https://claude.ai/api/mcp/auth_callback?error=denied",
    );
  });
});
