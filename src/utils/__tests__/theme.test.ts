import { renderHook } from "@testing-library/react-native";
import { Platform, useColorScheme } from "react-native";

import { EThemeMode } from "@/api/preferences";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";

import {
  DENSITY,
  THEMES,
  resolveTheme,
  sentimentTints,
  themes,
  useTheme,
  withOpacity,
} from "../theme";

// `react-native`'s `useColorScheme` lazily delegates to the default export of
// this submodule (see react-native/index.js), so mocking the submodule controls
// what the typed public `useColorScheme` — and therefore `useTheme` — resolves,
// without loading the full native module registry.
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

// With no ThemeProvider above it (as in these renders), `useTheme` has no saved
// preference to honor and falls back to the OS-scheme default: `dexter` (light)
// or `dark` (dark).
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
    expect(result.current.colors.background).toBe("#1d232a");
    expect(result.current.colors.surfaceSunken).toBe("#191e24");
    expect(result.current.colors.text).toBe("#ecf9ff");
  });

  it("returns the default light (dexter) theme when the device reports a light scheme", () => {
    mockUseColorScheme.mockReturnValue("light");

    const { result } = renderHook(() => useTheme());

    expect(result.current.colors).toBe(themes.dexter.colors);
    expect(result.current.colors.background).toBe("#fffbf4");
    expect(result.current.colors.surfaceSunken).toBe("#f7f1e7");
    expect(result.current.colors.text).toBe("#593d31");
  });

  it("switches themes when the device scheme changes", () => {
    mockUseColorScheme.mockReturnValue("light");
    const { result, rerender } = renderHook(() => useTheme());
    expect(result.current.colors.background).toBe("#fffbf4");

    mockUseColorScheme.mockReturnValue("dark");
    rerender({});
    expect(result.current.colors.background).toBe("#1d232a");
  });
});

describe("theme palettes", () => {
  it("uses the faithful daisyUI 'dark' priority accents for the dark theme", () => {
    expect(themes.dark.colors.priority).toEqual([
      "#fcb700",
      "#ff627d",
      "#00bafe",
      "#1d232a",
      // base-content, not daisyUI's `neutral` — see below.
      "#ecf9ff",
    ]);
  });

  it("keeps the muted daisyUI 'dim' priority accents for the dim theme", () => {
    expect(themes.dim.colors.priority).toEqual([
      "#efd057",
      "#ffae9b",
      "#28ebff",
      "#2a303c",
      "#b2ccd6",
    ]);
    expect(themes.dim.colors.priorityContent).toEqual([
      "#141003",
      "#160b09",
      "#011316",
      "#b2ccd6",
      "#2a303c",
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

describe("density tiers", () => {
  // `compact` is web-only (see `useTheme`), and jest-expo's preset runs this
  // suite as iOS — so every compact assertion has to say so explicitly.
  // `restoreAllMocks` puts `Platform.OS` back; it leaves the module mocks above
  // alone, since those are factory `jest.fn()`s rather than spies.
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
    expect(result.current.fonts.body.fontSize).toBe(14);
    // `subtitle` deliberately matches `body` rather than sitting under it — see
    // the type-scale section of docs/design.md.
    expect(result.current.fonts.subtitle.fontSize).toBe(14);
    expect(result.current.controls.md).toBe(40);
  });

  it("uses the compact tier on a wide web viewport", () => {
    asWeb();
    mockUseIsLargeDevice.mockReturnValue(true);

    const { result } = renderHook(() => useTheme());

    expect(result.current.space).toBe(DENSITY.compact.space);
    expect(result.current.fonts.body.fontSize).toBe(12);
    expect(result.current.fonts.subtitle.fontSize).toBe(12);
    expect(result.current.controls.md).toBe(32);
  });

  // The tier DEX-61 tuned for a desktop pointer puts `controls.sm` at 26dp,
  // well under the 44pt iOS minimum tap target, so a tablet reads cramped on
  // it. Native opts out at every width.
  it("stays comfortable on a large native device", () => {
    mockUseIsLargeDevice.mockReturnValue(true);

    const { result } = renderHook(() => useTheme());

    expect(result.current.space).toBe(DENSITY.comfortable.space);
    expect(result.current.fonts.body.fontSize).toBe(14);
    expect(result.current.controls.md).toBe(40);
  });

  it("switches tiers when the web window crosses the breakpoint", () => {
    asWeb();
    mockUseIsLargeDevice.mockReturnValue(false);
    const { result, rerender } = renderHook(() => useTheme());
    expect(result.current.space.md).toBe(16);

    mockUseIsLargeDevice.mockReturnValue(true);
    rerender({});
    expect(result.current.space.md).toBe(12);
  });

  it("keeps the corner radius constant across tiers", () => {
    expect(DENSITY.compact.radii).toEqual(DENSITY.comfortable.radii);
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

describe("palette invariants", () => {
  const names = Object.keys(themes);

  it.each(names)("%s defines every color token", (name) => {
    const { colors } = themes[name];

    for (const key of Object.keys(themes.dexter.colors)) {
      expect(colors).toHaveProperty(key);
      expect(colors[key as keyof typeof colors]).toBeTruthy();
    }
  });

  // `THEMES` reads each mode off the palette, so the two can't disagree. What
  // the types don't catch is a palette that never gets offered for selection.
  it("offers every palette in the Appearance picker", () => {
    expect(THEMES.map((theme) => theme.name).sort()).toEqual([...names].sort());
  });

  it.each(names)("%s has one entry per priority in each array", (name) => {
    const { priority, priorityMuted, priorityContent } = themes[name].colors;

    expect(priority).toHaveLength(5);
    expect(priorityMuted).toHaveLength(5);
    expect(priorityContent).toHaveLength(5);
  });

  it.each(names)("%s draws its chrome on distinct surfaces", (name) => {
    const { background, surfaceSunken, border } = themes[name].colors;

    // Opaque, so a border stays visible over any surface and the chrome reads
    // as a different plane rather than a tint of whatever is behind it.
    for (const color of [background, surfaceSunken, border]) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(surfaceSunken).not.toBe(background);
    expect(border).not.toBe(background);
  });

  // The app's brightness anchor (DEX-61): content is the lightest plane in
  // every theme, light or dark, and chrome recedes from it — the inverse of a
  // "cards float above the page" ramp, and what keeps the app reading at the
  // same brightness as the legacy web app. A divider recedes furthest of all:
  // a hairline is drawn by taking light away on every theme, not by adding it
  // back on the dark ones.
  it.each(names)("%s sinks its chrome and dividers below content", (name) => {
    const { background, surfaceSunken, border } = themes[name].colors;
    const lightness = (hex: string) =>
      [1, 3, 5].reduce((sum, i) => sum + parseInt(hex.slice(i, i + 2), 16), 0);

    expect(lightness(background)).toBeGreaterThan(lightness(surfaceSunken));
    expect(lightness(border)).toBeLessThan(lightness(surfaceSunken));
  });

  it.each(names)("%s pre-blends opaque priority card fills", (name) => {
    const { priority, priorityMuted } = themes[name].colors;

    priorityMuted.forEach((muted, i) => {
      expect(muted).toMatch(/^#[0-9a-f]{6}$/);
      // The fill is a muted version of the accent, never the accent itself.
      expect(muted).not.toBe(priority[i]);
    });
  });

  it("blends the accent over the theme background at 80%", () => {
    // #fcb700 at 80% over dark's #1d232a background.
    expect(themes.dark.colors.priorityMuted[0]).toBe("#cf9908");
    // #ff627d at 80% over dexter's #fffbf4 background.
    expect(themes.dexter.colors.priorityMuted[1]).toBe("#ff8195");
  });

  // The unprioritized card and the active nav tile are the same mark: a block
  // of the app's ink with the surface showing through the type on it. The tile
  // is `withOpacity(text, 0.8)` (`AppNav`), so the accent has to *be* `text` —
  // daisyUI's `neutral` is a dark swatch on every theme, which flipped the pair
  // apart on the dark ones (DEX-114). dexter satisfied this by accident, its
  // `neutral` and `base-content` being the same brown; now all five hold.
  it.each(names)("%s draws the unprioritized card in its ink", (name) => {
    const { priority, priorityContent, text, background } = themes[name].colors;

    expect(priority[4]).toBe(text);
    expect(priorityContent[4]).toBe(background);
  });

  // `priority[NEITHER]` is the theme's `base-100`, so blending it over the
  // `background` pane returns the pane and the card dissolved into it. Cards
  // carry no outline (DEX-114), so the fill has to draw the card by itself:
  // NEITHER takes `surfaceSunken` outright instead of a blend.
  it.each(names)("%s sinks the unprioritized fill below the pane", (name) => {
    const { background, surfaceSunken, priorityMuted } = themes[name].colors;

    expect(priorityMuted[3]).toBe(surfaceSunken);
    expect(priorityMuted[3]).not.toBe(background);
  });
});

// DEX-128. The Horoscope ritual step's panel colors. Asserted here rather than
// in the component because the reanimated jest mock's `interpolateColor` is a
// no-op — an animated `backgroundColor` never reaches a rendered tree, so this
// is the only place these values are observable at all.
describe("sentimentTints", () => {
  const schemes = ["light", "dark"] as const;
  const sentiments = ["positive", "negative", "mixed"] as const;
  const lightness = (hex: string) =>
    [1, 3, 5].reduce((sum, i) => sum + parseInt(hex.slice(i, i + 2), 16), 0);

  it.each(schemes)("%s pre-blends both ends opaque", (mode) => {
    for (const sentiment of sentiments) {
      const { base, peak } = sentimentTints(mode, sentiment);

      // Opaque, for the reason `priorityMuted` is: an alpha fill takes on
      // whatever is behind it, so interpolating between two alphas would drift
      // in hue as well as strength.
      expect(base).toMatch(/^#[0-9a-f]{6}$/);
      expect(peak).toMatch(/^#[0-9a-f]{6}$/);
      expect(peak).not.toBe(base);
    }
  });

  it("takes the brand values on a dark scheme", () => {
    expect(sentimentTints("dark", "positive").base).toBe("#010e0d");
    expect(sentimentTints("dark", "negative").base).toBe("#0f010c");
    expect(sentimentTints("dark", "mixed").base).toBe("#040810");
  });

  // The panel is drawn *on* a theme's `background`, so it has to be a surface
  // the page isn't — on every theme, not just the one it was eyeballed against.
  // The first cut put `mixed` at the same lightness as `dim`'s own background
  // and the panel dissolved into the page there, so the bar is the *palest*
  // dark background rather than an average. It deliberately is not the darkest:
  // `abyss` (#001e29) is deeper than two of the three hues, and a panel that
  // sits slightly above that page still reads perfectly well.
  it("keeps the deep shades below every dark palette's background", () => {
    const palest = Math.max(
      ...THEMES.filter((theme) => theme.mode === "dark").map((theme) =>
        lightness(themes[theme.name].colors.background),
      ),
    );

    for (const sentiment of sentiments) {
      expect(lightness(sentimentTints("dark", sentiment).base)).toBeLessThan(
        palest,
      );
    }
  });

  // The mirror on the other side. `light`'s background is pure white and
  // `dexter`'s is all but, so a pale panel has nowhere to go above them — it
  // stays a *recessed* surface, exactly as the deep one does, and reads because
  // it is darker than the page rather than brighter.
  it("keeps the pale shades below every light palette's background", () => {
    const dimmest = Math.min(
      ...THEMES.filter((theme) => theme.mode === "light").map((theme) =>
        lightness(themes[theme.name].colors.background),
      ),
    );

    for (const sentiment of sentiments) {
      expect(lightness(sentimentTints("light", sentiment).base)).toBeLessThan(
        dimmest,
      );
    }
  });

  // The whole point of the two-shade split: the panel carries `colors.text`,
  // so a light scheme's dark ink needs a pale panel and a dark scheme's light
  // ink needs a deep one. Dimming a single set would break one of the two.
  it.each(sentiments)("%s is pale on light and deep on dark", (sentiment) => {
    expect(lightness(sentimentTints("light", sentiment).base)).toBeGreaterThan(
      lightness(sentimentTints("dark", sentiment).base),
    );
  });

  it.each(schemes)("%s keeps the three sentiments distinct", (mode) => {
    const bases = sentiments.map(
      (sentiment) => sentimentTints(mode, sentiment).base,
    );

    expect(new Set(bases).size).toBe(3);
  });

  // Nothing here asserts how the breath *moves* — its amplitude and pace are
  // taste, tuned by eye against a real screen, and a test pinning either would
  // only have to be rewritten every time they are adjusted. What is worth
  // pinning is the palette: the brand values, and the light/dark split that
  // keeps `colors.text` readable on the panel.
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
