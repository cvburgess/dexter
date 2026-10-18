import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

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

  it("redirects to the first settings item in two-pane mode", async () => {
    mockUseIsLargeDevice.mockReturnValue(true);
    const screen = await render(<SettingsScreen />);

    expect(screen.getByText("redirect:/settings/account")).toBeTruthy();
  });

  it("renders the row list instead of redirecting in single-column mode", async () => {
    mockUseIsLargeDevice.mockReturnValue(false);
    const screen = await render(<SettingsScreen />);

    expect(screen.queryByText(/^redirect:/)).toBeNull();
    expect(screen.getByText("Account")).toBeTruthy();
  });

  it("renders a row for every settings item", async () => {
    const screen = await render(<SettingsScreen />);

    for (const title of [
      "Account",
      "Appearance",
      "Tasks",
      "Calendars",
      "Habits",
      "Ritual",
      "Notes",
      "Licenses",
    ]) {
      expect(screen.getByText(title)).toBeTruthy();
    }
  });

  // Bottom edge omitted so rows scroll under the tab bar; content must reserve
  // the inset itself or the last row can never clear it (DEX-91).
  it("adds the safe-area bottom inset to the list's own padding", async () => {
    const screen = await renderWithBottomInset(34, <SettingsScreen />);

    const [list] = screen.container.queryAll(
      (node) => node.type === "RCTScrollView",
    );
    const style = StyleSheet.flatten(list.props.contentContainerStyle);
    expect(style.paddingBottom).toBe(Number(style.padding) + 34);
  });

  it("navigates to the matching subview when a row is pressed", async () => {
    const screen = await render(<SettingsScreen />);

    await fireEvent.press(screen.getByTestId("settings-row-account"));
    expect(mockRouter.push).toHaveBeenCalledWith("/settings/account");

    await fireEvent.press(screen.getByTestId("settings-row-licenses"));
    expect(mockRouter.push).toHaveBeenCalledWith("/settings/licenses");
  });
});
