import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import AccountScreen from "@/app/(app)/(tabs)/settings/account";
import { deleteAccount, signOut } from "@/hooks/useAuth";

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

const mockClear = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ clear: mockClear }),
}));

const mockSignOut = signOut as jest.MockedFunction<typeof signOut>;
const mockDeleteAccount = deleteAccount as jest.MockedFunction<
  typeof deleteAccount
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
