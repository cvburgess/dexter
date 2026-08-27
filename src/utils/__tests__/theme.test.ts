import { renderHook } from "@testing-library/react-native";
import { Platform, useColorScheme } from "react-native";

import { EThemeMode } from "@/api/preferences";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";

import {
  DENSITY,
  THEMES,
  resolveTheme,
  sentimentInk,
  themes,
  useTheme,
  withOpacity,
} from "../theme";

// RN's `useColorScheme` lazily delegates to this submodule's default export, so
// mocking it drives `useTheme` without loading the full native module registry.
jest.mock("react-native/Libraries/Utilities/useColorScheme", () => ({
  __esModule: true,
  default: jest.fn(),
}));

// `useTheme` reads the breakpoint through this hook (not `useWindowDimensions`)
// precisely so tests can drive the density tier directly.
jest.mock("@/hooks/useIsLargeDevice", () => ({
  useIsLargeDevice: jest.fn(() => false),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;
const mockUseIsLargeDevice = useIsLargeDevice as jest.MockedFunction<
  typeof useIsLargeDevice
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

// With no ThemeProvider above it, `useTheme` has no saved preference and falls
// back to the OS-scheme default: `dexter` (light) or `dark` (dark).
describe("useTheme (no provider)", () => {
  afterEach(() => {
    mockUseColorScheme.mockReset();
    mockUseIsLargeDevice.mockReturnValue(false);
  });

  it("returns the default dark theme when the device reports a dark scheme", () => {
    mockUseColorScheme.mockReturnValue("dark");

    const { result } = renderHook(() => useTheme());

    // `useTheme` composes palette + density, so identity is on `colors`.
    expect(result.current.colors).toBe(themes.dark.colors);
  });

  it("returns the default light (dexter) theme when the device reports a light scheme", () => {
    mockUseColorScheme.mockReturnValue("light");

    const { result } = renderHook(() => useTheme());

    expect(result.current.colors).toBe(themes.dexter.colors);
  });

  it("switches themes when the device scheme changes", () => {
    mockUseColorScheme.mockReturnValue("light");
    const { result, rerender } = renderHook(() => useTheme());
    expect(result.current.colors).toBe(themes.dexter.colors);

    mockUseColorScheme.mockReturnValue("dark");
    rerender({});
    expect(result.current.colors).toBe(themes.dark.colors);
  });
});

describe("density tiers", () => {
  // `compact` is web-only and jest-expo runs as iOS, so compact assertions set
  // web explicitly. `restoreAllMocks` restores `Platform.OS`, not factory mocks.
  const asWeb = () => jest.replaceProperty(Platform, "OS", "web");

  afterEach(() => {
    jest.restoreAllMocks();
    mockUseColorScheme.mockReset();
    mockUseIsLargeDevice.mockReturnValue(false);
  });

  it("uses the comfortable tier below the large-device breakpoint", () => {
    asWeb();
    mockUseIsLargeDevice.mockReturnValue(false);

    const { result } = renderHook(() => useTheme());

    expect(result.current.space).toBe(DENSITY.comfortable.space);
  });

  it("uses the compact tier on a wide web viewport", () => {
    asWeb();
    mockUseIsLargeDevice.mockReturnValue(true);

    const { result } = renderHook(() => useTheme());

    expect(result.current.space).toBe(DENSITY.compact.space);
  });

  // DEX-61's pointer tier puts `controls.sm` at 26dp — under iOS's 44pt tap
  // target — so native opts out at every width.
  it("stays comfortable on a large native device", () => {
    mockUseIsLargeDevice.mockReturnValue(true);

    const { result } = renderHook(() => useTheme());

    expect(result.current.space).toBe(DENSITY.comfortable.space);
  });

  it("switches tiers when the web window crosses the breakpoint", () => {
    asWeb();
    mockUseIsLargeDevice.mockReturnValue(false);
    const { result, rerender } = renderHook(() => useTheme());
    expect(result.current.space).toBe(DENSITY.comfortable.space);

    mockUseIsLargeDevice.mockReturnValue(true);
    rerender({});
    expect(result.current.space).toBe(DENSITY.compact.space);
  });

  it("never sizes a compact token larger than its comfortable counterpart", () => {
    const { space, fonts, controls, icons } = DENSITY.comfortable;

    for (const key of Object.keys(space) as (keyof typeof space)[]) {
      expect(DENSITY.compact.space[key]).toBeLessThanOrEqual(space[key]);
    }
    for (const key of Object.keys(fonts) as (keyof typeof fonts)[]) {
      expect(DENSITY.compact.fonts[key].fontSize).toBeLessThanOrEqual(
        fonts[key].fontSize,
      );
      expect(DENSITY.compact.fonts[key].fontWeight).toBe(fonts[key].fontWeight);
    }
    for (const key of Object.keys(controls) as (keyof typeof controls)[]) {
      expect(DENSITY.compact.controls[key]).toBeLessThanOrEqual(controls[key]);
    }
    for (const key of Object.keys(icons) as (keyof typeof icons)[]) {
      expect(DENSITY.compact.icons[key]).toBeLessThanOrEqual(icons[key]);
    }
  });
});

// `THEMES` reads each mode off the palette, so the two can't disagree. What
// the types don't catch is a palette that never gets offered for selection.
it("offers every palette in the Appearance picker", () => {
  expect(THEMES.map((theme) => theme.name).sort()).toEqual(
    Object.keys(themes).sort(),
  );
});

// The sentiment panel ignores the user's scheme, so a light theme's
// `colors.text` is near-black ink over a near-black panel — the guard (DEX-128).
describe("sentimentInk", () => {
  // `textSecondary` is an alpha of `text` on every palette, so this reads both
  // forms; the panel beneath is opaque, so the alpha composites to dimmer ink.
  const lightness = (color: string) => {
    const rgb = color.startsWith("#")
      ? [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
      : (color.match(/\d+/g) ?? []).slice(0, 3).map(Number);

    return rgb.reduce((sum, value) => sum + value, 0);
  };

  // Panel bases total under 40 of 765, so a generous floor still fails loudly
  // the moment a light theme's own ink leaks through — `dexter`'s `text` is 183.
  const READABLE = 400;

  it.each(THEMES.map((theme) => theme.name))(
    "%s reads on the panel",
    (name) => {
      const palette = themes[name];
      const ink = sentimentInk({
        ...DENSITY.comfortable,
        colors: palette.colors,
        mode: palette.mode,
      });

      expect(lightness(ink.text)).toBeGreaterThan(READABLE);
      expect(lightness(ink.textSecondary)).toBeGreaterThan(READABLE);
    },
  );

  // A dark theme keeps its own ink, so the user's palette still shows through
  // wherever it can — only light themes borrow.
  it("keeps a dark theme's own ink", () => {
    const palette = themes.abyss;
    const ink = sentimentInk({
      ...DENSITY.comfortable,
      colors: palette.colors,
      mode: palette.mode,
    });

    expect(ink.text).toBe(palette.colors.text);
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
