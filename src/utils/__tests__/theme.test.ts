import { renderHook } from "@testing-library/react-native";
import { useColorScheme } from "react-native";

import { EThemeMode } from "@/api/preferences";

import { resolveTheme, themes, useTheme, withOpacity } from "../theme";

// `react-native`'s `useColorScheme` lazily delegates to the default export of
// this submodule (see react-native/index.js), so mocking the submodule controls
// what the typed public `useColorScheme` — and therefore `useTheme` — resolves,
// without loading the full native module registry.
jest.mock("react-native/Libraries/Utilities/useColorScheme", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;

describe("withOpacity", () => {
  it("applies an alpha channel to a hex color", () => {
    expect(withOpacity("#593d31", 0.25)).toBe("rgba(89, 61, 49, 0.25)");
  });

  it("multiplies the existing alpha when given an rgba color", () => {
    expect(withOpacity("rgba(89, 61, 49, 0.25)", 0.1)).toBe(
      "rgba(89, 61, 49, 0.025)",
    );
  });

  it("treats an rgb color with no alpha as fully opaque before multiplying", () => {
    expect(withOpacity("rgb(89, 61, 49)", 0.5)).toBe("rgba(89, 61, 49, 0.5)");
  });
});

// With no ThemeProvider above it (as in these renders), `useTheme` has no saved
// preference to honor and falls back to the OS-scheme default: `dexter` (light)
// or `dark` (dark).
describe("useTheme (no provider)", () => {
  afterEach(() => mockUseColorScheme.mockReset());

  it("returns the default dark theme when the device reports a dark scheme", () => {
    mockUseColorScheme.mockReturnValue("dark");

    const { result } = renderHook(() => useTheme());

    expect(result.current).toBe(themes.dark);
    expect(result.current.colors.background).toBe("#191e24");
    expect(result.current.colors.card).toBe("#1d232a");
    expect(result.current.colors.text).toBe("#ecf9ff");
  });

  it("returns the default light (dexter) theme when the device reports a light scheme", () => {
    mockUseColorScheme.mockReturnValue("light");

    const { result } = renderHook(() => useTheme());

    expect(result.current).toBe(themes.dexter);
    expect(result.current.colors.background).toBe("#f7f1e7");
    expect(result.current.colors.card).toBe("#fffbf4");
    expect(result.current.colors.text).toBe("#593d31");
  });

  it("switches themes when the device scheme changes", () => {
    mockUseColorScheme.mockReturnValue("light");
    const { result, rerender } = renderHook(() => useTheme());
    expect(result.current.colors.background).toBe("#f7f1e7");

    mockUseColorScheme.mockReturnValue("dark");
    rerender({});
    expect(result.current.colors.background).toBe("#191e24");
  });
});

describe("theme palettes", () => {
  it("uses the faithful daisyUI 'dark' priority accents for the dark theme", () => {
    expect(themes.dark.colors.priority).toEqual([
      "#fcb700",
      "#ff627d",
      "#00bafe",
      "#1d232a",
      "#09090b",
    ]);
  });

  it("keeps the muted daisyUI 'dim' priority accents for the dim theme", () => {
    expect(themes.dim.colors.priority).toEqual([
      "#efd057",
      "#ffae9b",
      "#28ebff",
      "#2a303c",
      "#1c212b",
    ]);
    expect(themes.dim.colors.priorityContent).toEqual([
      "#141003",
      "#160b09",
      "#011316",
      "#b2ccd6",
      "#b2ccd6",
    ]);
  });

  it("keeps the bolder 'dexter' priority accents for the light theme", () => {
    expect(themes.dexter.colors.priority).toEqual([
      "#fcb700",
      "#ff627d",
      "#00bafe",
      "#fffbf4",
      "#593d31",
    ]);
  });
});

describe("resolveTheme", () => {
  const prefs = {
    themeMode: EThemeMode.SYSTEM,
    lightTheme: "dexter",
    darkTheme: "dark",
  };

  it("follows the OS scheme in SYSTEM mode", () => {
    expect(resolveTheme(prefs, "light")).toBe(themes.dexter);
    expect(resolveTheme(prefs, "dark")).toBe(themes.dark);
  });

  it("forces the light theme in LIGHT mode regardless of OS scheme", () => {
    const forced = { ...prefs, themeMode: EThemeMode.LIGHT };
    expect(resolveTheme(forced, "dark")).toBe(themes.dexter);
  });

  it("forces the dark theme in DARK mode regardless of OS scheme", () => {
    const forced = { ...prefs, themeMode: EThemeMode.DARK };
    expect(resolveTheme(forced, "light")).toBe(themes.dark);
  });

  it("selects the named light and dark themes", () => {
    const custom = { ...prefs, lightTheme: "light", darkTheme: "abyss" };
    expect(resolveTheme(custom, "light")).toBe(themes.light);
    expect(resolveTheme(custom, "dark")).toBe(themes.abyss);
  });

  it("falls back to the default for the resolved scheme when a theme name is unknown", () => {
    const unknown = { ...prefs, lightTheme: "nope", darkTheme: "nope" };
    expect(resolveTheme(unknown, "light")).toBe(themes.dexter);
    expect(resolveTheme(unknown, "dark")).toBe(themes.dark);
  });
});
