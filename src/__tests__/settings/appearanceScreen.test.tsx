import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import AppearanceScreen from "@/app/(app)/(tabs)/settings/appearance";
import { EThemeMode } from "@/api/preferences";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { usePreferences } from "@/hooks/usePreferences";
import { renderWithBottomInset } from "@/testUtils/renderWithBottomInset";

jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));
jest.mock("@/hooks/useIsLargeDevice", () => ({ useIsLargeDevice: jest.fn() }));

jest.mock("react-native-safe-area-context", () =>
  require("@/testUtils/mockSafeAreaEdges").mockSafeAreaContext(),
);

const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;
const mockUseIsLargeDevice = useIsLargeDevice as jest.MockedFunction<
  typeof useIsLargeDevice
>;
const mockUpdate = jest.fn();

const mockPreferences = (
  overrides: Partial<{
    themeMode: EThemeMode;
    lightTheme: string;
    darkTheme: string;
  }> = {},
) => {
  mockUsePreferences.mockReturnValue([
    {
      themeMode: EThemeMode.SYSTEM,
      lightTheme: "dexter",
      darkTheme: "dark",
      ...overrides,
    } as never,
    { updatePreferences: mockUpdate },
  ]);
};

const flatStyle = (style: unknown) =>
  StyleSheet.flatten(style as Parameters<typeof StyleSheet.flatten>[0])!;

const renderWith = async (overrides = {}) => {
  mockPreferences(overrides);
  return await render(<AppearanceScreen />);
};

describe("AppearanceScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsLargeDevice.mockReturnValue(false);
  });

  // Every scrolling settings screen shares these edges via
  // settingsSafeAreaEdges.ts; asserted once, here (account.tsx is the exception).
  it("skips the left safe-area edge in two-pane mode (sidebar owns it)", async () => {
    mockUseIsLargeDevice.mockReturnValue(true);
    const screen = await renderWith();

    expect(screen.getByTestId("safe-area-edges-right")).toBeTruthy();
  });

  it("includes the left safe-area edge in single-column mode", async () => {
    const screen = await renderWith();

    expect(screen.getByTestId("safe-area-edges-left,right")).toBeTruthy();
  });

  // Edges omit `bottom` so cards scroll under the tab bar; content must reserve
  // the inset itself or the last card can never clear it (DEX-91).
  it("adds the safe-area bottom inset to the scroll content's own padding", async () => {
    mockPreferences();
    const screen = await renderWithBottomInset(34, <AppearanceScreen />);

    const [scrollView] = screen.container.queryAll(
      (node) => node.type === "RCTScrollView",
    );
    const style = flatStyle(scrollView.props.contentContainerStyle);
    expect(style.paddingBottom).toBe(Number(style.padding) + 34);
  });

  // DEX-109: the card's single `gap` is the space between swatches and name.
  // Asserted against the card's own padding, not a literal, to pin the intent.
  it("gives a theme card's swatches and title the same air as the card's inset", async () => {
    const screen = await renderWith();

    const style = flatStyle(
      screen.getByTestId("appearance-theme-dexter").props.style,
    );
    expect(style.gap).toBe(style.padding);
  });

  // The swatches used to take `flex: 1` against a fixed height, which drew them
  // as tall ovals. They are circles: a square box at `radii.full`.
  it("draws a theme card's color swatches as circles", async () => {
    const screen = await renderWith();

    const swatches = screen.getByTestId("appearance-swatches-dexter");
    for (const swatch of swatches.props.children) {
      const style = flatStyle(swatch.props.style);
      expect(style.width).toBe(style.height);
      expect(style.borderRadius).toBe(999);
    }
  });

  it("renders the mode control and both theme sections in SYSTEM mode", async () => {
    const screen = await renderWith();

    expect(screen.getByTestId("appearance-mode-system")).toBeTruthy();
    // Light themes
    expect(screen.getByTestId("appearance-theme-dexter")).toBeTruthy();
    expect(screen.getByTestId("appearance-theme-light")).toBeTruthy();
    // Dark themes
    expect(screen.getByTestId("appearance-theme-dim")).toBeTruthy();
    expect(screen.getByTestId("appearance-theme-dark")).toBeTruthy();
    expect(screen.getByTestId("appearance-theme-abyss")).toBeTruthy();
  });

  it("saves the mode when a mode pill is pressed", async () => {
    const screen = await renderWith();

    await fireEvent.press(screen.getByTestId("appearance-mode-dark"));

    expect(mockUpdate).toHaveBeenCalledWith({ themeMode: EThemeMode.DARK });
  });

  it("saves the light theme when a light card is pressed", async () => {
    const screen = await renderWith();

    await fireEvent.press(screen.getByTestId("appearance-theme-light"));

    expect(mockUpdate).toHaveBeenCalledWith({ lightTheme: "light" });
  });

  it("saves the dark theme when a dark card is pressed", async () => {
    const screen = await renderWith();

    await fireEvent.press(screen.getByTestId("appearance-theme-abyss"));

    expect(mockUpdate).toHaveBeenCalledWith({ darkTheme: "abyss" });
  });

  it("hides the dark section when the mode is forced to LIGHT", async () => {
    const screen = await renderWith({ themeMode: EThemeMode.LIGHT });

    expect(screen.getByTestId("appearance-theme-dexter")).toBeTruthy();
    expect(screen.queryByTestId("appearance-theme-abyss")).toBeNull();
  });

  it("hides the light section when the mode is forced to DARK", async () => {
    const screen = await renderWith({ themeMode: EThemeMode.DARK });

    expect(screen.getByTestId("appearance-theme-abyss")).toBeTruthy();
    expect(screen.queryByTestId("appearance-theme-dexter")).toBeNull();
  });
});
