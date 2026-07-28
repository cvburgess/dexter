import { fireEvent, render } from "@testing-library/react-native";
import { FlatList, StyleSheet } from "react-native";
import type { ViewStyle } from "react-native";

import SettingsScreen from "@/app/(app)/(tabs)/settings";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { renderWithBottomInset } from "@/testUtils/renderWithBottomInset";

jest.mock("@/hooks/useIsLargeDevice", () => ({ useIsLargeDevice: jest.fn() }));

const mockRouter = { back: jest.fn(), push: jest.fn() };
jest.mock("expo-router", () => {
  const { Text } = require("react-native");
  return {
    useRouter: () => mockRouter,
    // Render a marker exposing the target href so the two-pane redirect is
    // observable without mounting a real navigator.
    Redirect: ({ href }: { href: string }) => <Text>redirect:{href}</Text>,
  };
});

const mockUseIsLargeDevice = useIsLargeDevice as jest.MockedFunction<
  typeof useIsLargeDevice
>;

describe("SettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsLargeDevice.mockReturnValue(false);
  });

  it("redirects to the first settings item in two-pane mode", () => {
    mockUseIsLargeDevice.mockReturnValue(true);
    const screen = render(<SettingsScreen />);

    expect(screen.getByText("redirect:/settings/account")).toBeTruthy();
  });

  it("renders the row list instead of redirecting in single-column mode", () => {
    mockUseIsLargeDevice.mockReturnValue(false);
    const screen = render(<SettingsScreen />);

    expect(screen.queryByText(/^redirect:/)).toBeNull();
    expect(screen.getByText("Account")).toBeTruthy();
  });

  it("renders a row for every settings item", () => {
    const screen = render(<SettingsScreen />);

    for (const title of [
      "Account",
      "Appearance",
      "Tasks",
      "Calendars",
      "Habits",
      "Journal",
      "Notes",
      "Licenses",
    ]) {
      expect(screen.getByText(title)).toBeTruthy();
    }
  });

  // The screen omits the bottom safe-area edge so rows scroll under the tab
  // bar; the list content is what reserves the inset, or the last row can never
  // be scrolled clear of it (DEX-91).
  it("adds the safe-area bottom inset to the list's own padding", () => {
    const screen = renderWithBottomInset(34, <SettingsScreen />);

    const style = StyleSheet.flatten(
      screen.UNSAFE_getByType(FlatList).props
        .contentContainerStyle as ViewStyle[],
    );
    expect(style.paddingBottom).toBe(Number(style.padding) + 34);
  });

  it("navigates to the matching subview when a row is pressed", () => {
    const screen = render(<SettingsScreen />);

    fireEvent.press(screen.getByTestId("settings-row-account"));
    expect(mockRouter.push).toHaveBeenCalledWith("/settings/account");

    fireEvent.press(screen.getByTestId("settings-row-licenses"));
    expect(mockRouter.push).toHaveBeenCalledWith("/settings/licenses");
  });
});
