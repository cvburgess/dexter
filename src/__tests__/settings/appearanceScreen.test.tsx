import { fireEvent, render } from "@testing-library/react-native";
import { ScrollView, StyleSheet } from "react-native";
import type { ViewStyle } from "react-native";

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

const renderWith = (overrides = {}) => {
  mockPreferences(overrides);
  return render(<AppearanceScreen />);
};

describe("AppearanceScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsLargeDevice.mockReturnValue(false);
  });

  // Every settings screen that scrolls shares these edge arrays through
  // settingsSafeAreaEdges.ts; the pair is asserted once, here. (account.tsx
  // builds its own edges — the bottom-edge exception — and keeps its own pair.)
  it("skips the left safe-area edge in two-pane mode (sidebar owns it)", () => {
    mockUseIsLargeDevice.mockReturnValue(true);
    const screen = renderWith();

    expect(screen.getByTestId("safe-area-edges-right")).toBeTruthy();
  });

  it("includes the left safe-area edge in single-column mode", () => {
    const screen = renderWith();

    expect(screen.getByTestId("safe-area-edges-left,right")).toBeTruthy();
  });

  // The edges above omit `bottom` so cards scroll under the tab bar; the scroll
  // content is what has to reserve the inset, or the last one can never be
  // scrolled clear of it (DEX-91).
  it("adds the safe-area bottom inset to the scroll content's own padding", () => {
    mockPreferences();
    const screen = renderWithBottomInset(34, <AppearanceScreen />);

    const style = StyleSheet.flatten(
      screen.UNSAFE_getByType(ScrollView).props
        .contentContainerStyle as ViewStyle[],
    );
    expect(style.paddingBottom).toBe(Number(style.padding) + 34);
  });

  // DEX-109. A theme card's only two children are its swatch row and its title
  // row, so the card's single `gap` is the space between the colors and the
  // name. Asserting it against the card's own padding rather than a literal
  // pins the intent — one step, the standard inset, at either density — and
  // fails if it drops back to the tighter in-group step it used to be.
  it("gives a theme card's swatches and title the same air as the card's inset", () => {
    const screen = renderWith();

    const style = StyleSheet.flatten(
      screen.getByTestId("appearance-theme-dexter").props.style as ViewStyle[],
    );
    expect(style.gap).toBe(style.padding);
  });

  // The swatches used to take `flex: 1` against a fixed height, which drew them
  // as tall ovals. They are circles: a square box at `radii.full`.
  it("draws a theme card's color swatches as circles", () => {
    const screen = renderWith();

    const swatches = screen.getByTestId("appearance-swatches-dexter");
    for (const swatch of swatches.props.children) {
      const style = StyleSheet.flatten(swatch.props.style as ViewStyle);
      expect(style.width).toBe(style.height);
      expect(style.borderRadius).toBe(999);
    }
  });

  it("renders the mode control and both theme sections in SYSTEM mode", () => {
    const screen = renderWith();

    expect(screen.getByTestId("appearance-mode-system")).toBeTruthy();
    // Light themes
    expect(screen.getByTestId("appearance-theme-dexter")).toBeTruthy();
    expect(screen.getByTestId("appearance-theme-light")).toBeTruthy();
    // Dark themes
    expect(screen.getByTestId("appearance-theme-dim")).toBeTruthy();
    expect(screen.getByTestId("appearance-theme-dark")).toBeTruthy();
    expect(screen.getByTestId("appearance-theme-abyss")).toBeTruthy();
  });

  it("saves the mode when a mode pill is pressed", () => {
    const screen = renderWith();

    fireEvent.press(screen.getByTestId("appearance-mode-dark"));

    expect(mockUpdate).toHaveBeenCalledWith({ themeMode: EThemeMode.DARK });
  });

  it("saves the light theme when a light card is pressed", () => {
    const screen = renderWith();

    fireEvent.press(screen.getByTestId("appearance-theme-light"));

    expect(mockUpdate).toHaveBeenCalledWith({ lightTheme: "light" });
  });

  it("saves the dark theme when a dark card is pressed", () => {
    const screen = renderWith();

    fireEvent.press(screen.getByTestId("appearance-theme-abyss"));

    expect(mockUpdate).toHaveBeenCalledWith({ darkTheme: "abyss" });
  });

  it("hides the dark section when the mode is forced to LIGHT", () => {
    const screen = renderWith({ themeMode: EThemeMode.LIGHT });

    expect(screen.getByTestId("appearance-theme-dexter")).toBeTruthy();
    expect(screen.queryByTestId("appearance-theme-abyss")).toBeNull();
  });

  it("hides the light section when the mode is forced to DARK", () => {
    const screen = renderWith({ themeMode: EThemeMode.DARK });

    expect(screen.getByTestId("appearance-theme-abyss")).toBeTruthy();
    expect(screen.queryByTestId("appearance-theme-dexter")).toBeNull();
  });
});
