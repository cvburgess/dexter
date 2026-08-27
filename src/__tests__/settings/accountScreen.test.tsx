import { fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  Alert,
  StyleSheet,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import AccountScreen from "@/app/(app)/(tabs)/settings/account";
import { deleteAccount, signOut } from "@/hooks/useAuth";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { themes } from "@/utils/theme";

/** The resolved color of a button's label, for comparing the two variants. */
const labelColor = (screen: ReturnType<typeof render>, label: string) =>
  StyleSheet.flatten(screen.getByText(label).props.style as TextStyle[]).color;

jest.mock("@/hooks/useAuth", () => ({
  signOut: jest.fn(),
  deleteAccount: jest.fn(),
  useAuth: () => ({
    session: {
      user: {
        email: "ada@example.com",
        user_metadata: { full_name: "Ada Lovelace" },
      },
    },
  }),
}));

jest.mock("@/hooks/useIsLargeDevice", () => ({ useIsLargeDevice: jest.fn() }));

jest.mock("react-native-safe-area-context", () =>
  require("@/testUtils/mockSafeAreaEdges").mockSafeAreaContext(),
);

const mockClear = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ clear: mockClear }),
}));

const mockSignOut = signOut as jest.MockedFunction<typeof signOut>;
const mockDeleteAccount = deleteAccount as jest.MockedFunction<
  typeof deleteAccount
>;
const mockUseIsLargeDevice = useIsLargeDevice as jest.MockedFunction<
  typeof useIsLargeDevice
>;

// Confirm a destructive Alert by pressing its destructive button.
const confirmAlert = () =>
  jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
    buttons?.find((b) => b.style === "destructive")?.onPress?.();
  });

// Dismiss a destructive Alert by pressing its cancel button.
const cancelAlert = () =>
  jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
    buttons?.find((b) => b.style === "cancel")?.onPress?.();
  });

describe("AccountScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsLargeDevice.mockReturnValue(false);
  });

  // account.tsx builds its own edges (it claims `bottom`); the shared
  // settingsSafeAreaEdges pair is asserted once, in appearanceScreen.test.tsx.
  it("skips the left safe-area edge in two-pane mode (sidebar owns it)", () => {
    mockUseIsLargeDevice.mockReturnValue(true);
    const screen = render(<AccountScreen />);

    expect(screen.getByTestId("safe-area-edges-bottom,right")).toBeTruthy();
  });

  it("includes the left safe-area edge in single-column mode", () => {
    mockUseIsLargeDevice.mockReturnValue(false);
    const screen = render(<AccountScreen />);

    expect(
      screen.getByTestId("safe-area-edges-bottom,left,right"),
    ).toBeTruthy();
  });

  it("renders the signed-in user's name and email", () => {
    const screen = render(<AccountScreen />);
    expect(screen.getByTestId("account-name")).toHaveTextContent(
      "Ada Lovelace",
    );
    expect(screen.getByTestId("account-email")).toHaveTextContent(
      "ada@example.com",
    );
  });

  // Both were full-width `dangerous` buttons, so ending a session looked like
  // destroying the account (DEX-108) — now only one wears the error color.
  it("draws log out and delete account with different weight", () => {
    const screen = render(<AccountScreen />);
    const { colors } = themes.dexter;

    const logOut = screen.getByTestId("settings-log-out-button");
    const deleteAccountButton = screen.getByTestId(
      "settings-delete-account-button",
    );

    expect(labelColor(screen, "Log Out")).toBe(colors.text);
    expect(labelColor(screen, "Delete Account")).toBe(colors.error);

    expect(StyleSheet.flatten(logOut.props.style as ViewStyle[]).flex).toBe(1);
    expect(
      StyleSheet.flatten(deleteAccountButton.props.style as ViewStyle[]).flex,
    ).toBeUndefined();
  });

  it("signs out and clears cached data when the log out is confirmed", async () => {
    confirmAlert();

    const screen = render(<AccountScreen />);
    fireEvent.press(screen.getByTestId("settings-log-out-button"));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
    expect(mockClear).toHaveBeenCalledTimes(1);
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it("does not sign out when the log out is cancelled", async () => {
    cancelAlert();

    const screen = render(<AccountScreen />);
    fireEvent.press(screen.getByTestId("settings-log-out-button"));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockClear).not.toHaveBeenCalled();
  });

  it("deletes the account and clears cached data when confirmed", async () => {
    confirmAlert();

    const screen = render(<AccountScreen />);
    fireEvent.press(screen.getByTestId("settings-delete-account-button"));

    await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalledTimes(1));
    expect(mockClear).toHaveBeenCalledTimes(1);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("does not delete the account when cancelled", async () => {
    cancelAlert();

    const screen = render(<AccountScreen />);
    fireEvent.press(screen.getByTestId("settings-delete-account-button"));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect(mockDeleteAccount).not.toHaveBeenCalled();
    expect(mockClear).not.toHaveBeenCalled();
  });
});
