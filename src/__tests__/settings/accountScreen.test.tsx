import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import AccountScreen from "@/app/(app)/(tabs)/settings/account";
import { signOut } from "@/hooks/useAuth";

jest.mock("@/hooks/useAuth", () => ({ signOut: jest.fn() }));

const mockClear = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ clear: mockClear }),
}));

const mockSignOut = signOut as jest.MockedFunction<typeof signOut>;

describe("AccountScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("signs out and clears cached data when the log out is confirmed", async () => {
    // Confirm the native alert by pressing its destructive button.
    jest
      .spyOn(Alert, "alert")
      .mockImplementation((_title, _message, buttons) => {
        buttons?.find((b) => b.style === "destructive")?.onPress?.();
      });

    const screen = render(<AccountScreen />);
    fireEvent.press(screen.getByTestId("settings-log-out-button"));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
    expect(mockClear).toHaveBeenCalledTimes(1);
  });

  it("does not sign out when the log out is cancelled", async () => {
    // Dismiss the alert by pressing its cancel button.
    jest
      .spyOn(Alert, "alert")
      .mockImplementation((_title, _message, buttons) => {
        buttons?.find((b) => b.style === "cancel")?.onPress?.();
      });

    const screen = render(<AccountScreen />);
    fireEvent.press(screen.getByTestId("settings-log-out-button"));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockClear).not.toHaveBeenCalled();
  });
});
