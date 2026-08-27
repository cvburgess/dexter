import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { Platform, useColorScheme } from "react-native";

import { THoroscopeSentiment } from "@/api/horoscopes";
import { EThemeMode } from "@/api/preferences";
import { ETaskPriority } from "@/api/tasks";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";

/**
 * The color half of a theme. Varies by the theme the user picked; never by
 * screen size. See `docs/design.md` for what belongs on each surface.
 */
export interface TThemeColors {
  primary: string;
  primaryContent: string;
  /**
   * The content sheet, and the lightest surface in the theme (daisyUI
   * `base-100`); everything that frames it recedes to `surfaceSunken`.
   */
  background: string;
  /**
   * Sunken *below* `background` (daisyUI `base-200`) — anything that frames or
   * holds content rather than being content (DEX-61).
   */
  surfaceSunken: string;
  /**
   * Hairline borders, a step *darker* than the surfaces on every theme. Opaque
   * and tuned per theme: one alpha of `text` can't read on both schemes (DEX-61).
   */
  border: string;
  text: string;
  textSecondary: string;
  error: string;
  errorContent: string;
  success: string;
  successContent: string;
  /**
   * Full-strength priority accents, indexed by `ETaskPriority`. `UNPRIORITIZED`
   * alone skips its daisyUI token and takes this theme's `text` (DEX-114).
   */
  priority: string[];
  /**
   * Solid card fills: each accent pre-blended over `background` so a card can't
   * shift color over other panes (DEX-61). `NEITHER` — see `mutePriorities`.
   */
  priorityMuted: string[];
  /** Text color readable on top of the matching `priority` color (the daisyUI tokens' `-content` pair). */
  priorityContent: string[];
}

/** A selectable theme. Density tokens are composed in by `useTheme`, not stored here. */
export type TThemePalette = {
  colors: TThemeColors;
  /**
   * On the palette (not just `THEMES`) for native components that theme
   * themselves — Android's menu ignores an in-app scheme otherwise (`IconMenu`).
   */
  mode: "light" | "dark";
};

/** A type role: a size paired with the weight that role is always drawn at. */
type TFont<W extends string> = { fontSize: number; fontWeight: W };

/**
 * The numeric half of a theme. Varies by screen size (see `DENSITY`); never by
 * which theme the user picked.
 */
export interface TDensityTokens {
  /** Padding, margins, and flex gaps. `md` is the standard screen inset. */
  space: { xs: number; sm: number; md: number; lg: number };
  fonts: {
    /** The second line under a `title` — a row's detail, a section's explanation. */
    subtitle: TFont<"400">;
    /** Default body copy — task titles, row labels, calendar event names. */
    body: TFont<"400">;
    /**
     * Controls. **Never below 16 on `comfortable`** — iOS Safari zooms inputs
     * under 16px on mobile web; split from `title` so tuning it can't regress this.
     */
    control: TFont<"600">;
    /** A component's primary line — a row's name, a field's label. */
    title: TFont<"600">;
    /** Names the screen or pane you are on. */
    heading: TFont<"700">;
    /** The login splash only. */
    display: TFont<"900">;
  };
  /**
   * `md` is the app's one corner radius. `full` is for circles and pills, and
   * deliberately not a point on the radius scale.
   */
  radii: { md: number; full: number };
  /** Diameters for round tap targets. `md` = icon buttons and tiles, `sm` = inline controls. */
  controls: { md: number; sm: number };
  /**
   * Glyph sizes, separate from `fonts`: an icon's optical size doesn't track
   * the type beside it — a 20pt icon reads as the peer of a 16pt label.
   */
  icons: { sm: number; md: number };
}

export interface Theme extends TDensityTokens {
  colors: TThemeColors;
  /** The active palette's `mode` — see `TThemePalette`. */
  mode: "light" | "dark";
}

/**
 * `compact` applies on **web** at and above `LARGE_DEVICE_MIN_WIDTH` (DEX-61).
 * Native stays `comfortable` at every width — see `useTheme` for why.
 */
export type TDensity = "comfortable" | "compact";

/**
 * Written out in full, not derived from a multiplier: spacing tightens harder
 * than type does, and literals stay reviewable against `docs/design.md`.
 */
export const DENSITY: Record<TDensity, TDensityTokens> = {
  comfortable: {
    space: { xs: 4, sm: 8, md: 16, lg: 24 },
    fonts: {
      // `subtitle` matches `body`'s size on purpose — see docs/design.md. A
      // second line at 12 read as fine print rather than as content.
      subtitle: { fontSize: 14, fontWeight: "400" },
      body: { fontSize: 14, fontWeight: "400" },
      control: { fontSize: 16, fontWeight: "600" },
      title: { fontSize: 16, fontWeight: "600" },
      heading: { fontSize: 24, fontWeight: "700" },
      display: { fontSize: 40, fontWeight: "900" },
    },
    radii: { md: 12, full: 999 },
    controls: { md: 40, sm: 32 },
    icons: { sm: 14, md: 24 },
  },
  compact: {
    space: { xs: 3, sm: 6, md: 12, lg: 18 },
    fonts: {
      subtitle: { fontSize: 12, fontWeight: "400" },
      body: { fontSize: 12, fontWeight: "400" },
      control: { fontSize: 14, fontWeight: "600" },
      title: { fontSize: 14, fontWeight: "600" },
      heading: { fontSize: 20, fontWeight: "700" },
      display: { fontSize: 32, fontWeight: "900" },
    },
    // Corner radius is a brand constant, not a density one — a card reads as
    // the same card on both tiers, just a smaller one.
    radii: { md: 12, full: 999 },
    controls: { md: 32, sm: 26 },
    icons: { sm: 12, md: 22 },
  },
};

/** The alpha task cards composited their priority tint at before `priorityMuted` pre-blended it. */
const CARD_FILL_ALPHA = 0.8;

/** Composites `color` over `over` at `alpha`, yielding an opaque `#rrggbb`. */
function blend(color: string, over: string, alpha: number): string {
  const channels = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];

  const fg = channels(color);
  const bg = channels(over);
  return `#${fg
    .map((value, i) =>
      Math.round(value * alpha + bg[i] * (1 - alpha))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/**
 * `NEITHER`'s accent *is* `base-100`, so blending it over `background` returns
 * the pane; cards carry no outline (DEX-114), so it takes `surfaceSunken`.
 */
const mutePriorities = (
  priority: string[],
  background: string,
  surfaceSunken: string,
): string[] => {
  const muted = priority.map((color) =>
    blend(color, background, CARD_FILL_ALPHA),
  );
  muted[ETaskPriority.NEITHER] = surfaceSunken;
  return muted;
};

/**
 * DEX-128: deliberately non-token (docs/design.md's exceptions list) — a night
 * sky on every theme, so panel ink is `sentimentInk`. Hand-tuned; blends washed out.
 */
const SENTIMENT_COLORS: Record<
  THoroscopeSentiment,
  { base: string; peak: string }
> = {
  // hsl(174 85% 6%) → 8%
  positive: { base: "#021c1a", peak: "#032622" },
  // hsl(311 90% 6%) → 8%
  negative: { base: "#1d0218", peak: "#270220" },
  // hsl(220 60% 7%) → 10% — deeper and wider than its neighbours: blue is the
  // darkest hue at a given lightness, so it needs extra to hold a visible breath.
  mixed: { base: "#070e1d", peak: "#0a1429" },
};

/** The two ends of the Horoscope panel's breathing color. */
export function sentimentTints(sentiment: THoroscopeSentiment): {
  base: string;
  peak: string;
} {
  return SENTIMENT_COLORS[sentiment];
}

/**
 * The app's only custom font. RN maps a family name to exactly one file — no
 * bold/italic resolution — so callers set fontWeight/fontStyle to "normal".
 */
export const SERIF = {
  /** Playfair Display, 700 italic. */
  displayItalic: "PlayfairDisplay_700Bold_Italic",
} as const;

/**
 * The Horoscope card's frame — white on every theme (DEX-128): `colors.border`
 * drew it from opposite sides per scheme, reading as two different objects.
 */
export const SENTIMENT_FRAME = "#ffffff";

/**
 * Ink for the sentiment panel — a night sky on every theme, so a light theme's
 * dark `colors.text` is invisible on it and borrows the default dark palette's.
 */
export function sentimentInk(theme: Theme): {
  text: string;
  textSecondary: string;
} {
  const { text, textSecondary } =
    theme.mode === "dark" ? theme.colors : themes[DEFAULT_DARK_THEME].colors;

  return { text, textSecondary };
}

// daisyUI themes ported oklch → hex (background=base-100, surfaceSunken=base-200,
// text=base-content — DEX-61); border is hand-picked, daisyUI has no token for it.
const DEXTER_PRIORITY = ["#fcb700", "#ff627d", "#00bafe", "#fffbf4", "#593d31"];
const dexter: TThemePalette = {
  mode: "light",
  colors: {
    primary: "#00674f",
    primaryContent: "#c3ffcf",
    background: "#fffbf4",
    surfaceSunken: "#f7f1e7",
    border: "#e0d5c2",
    text: "#593d31",
    textSecondary: "rgba(89, 61, 49, 0.6)",
    error: "#ff627d",
    errorContent: "#4d0218",
    success: "#00d390",
    successContent: "#004c39",
    priority: DEXTER_PRIORITY,
    priorityMuted: mutePriorities(DEXTER_PRIORITY, "#fffbf4", "#f7f1e7"),
    priorityContent: ["#793205", "#4d0218", "#042e49", "#593d31", "#fffbf4"],
  },
};

const LIGHT_PRIORITY = ["#fcb700", "#ff627d", "#00bafe", "#ffffff", "#18181b"];
const light: TThemePalette = {
  mode: "light",
  colors: {
    primary: "#422ad5",
    primaryContent: "#e0e7ff",
    background: "#ffffff",
    surfaceSunken: "#f8f8f8",
    border: "#e0e0e0",
    text: "#18181b",
    textSecondary: "rgba(24, 24, 27, 0.6)",
    error: "#ff627d",
    errorContent: "#4d0218",
    success: "#00d390",
    successContent: "#004c39",
    priority: LIGHT_PRIORITY,
    priorityMuted: mutePriorities(LIGHT_PRIORITY, "#ffffff", "#f8f8f8"),
    priorityContent: ["#793205", "#4d0218", "#042e49", "#18181b", "#ffffff"],
  },
};

// daisyUI "dim" — muted dark accents (the look DEX-23 shipped as the app's
// original single dark theme).
const DIM_PRIORITY = ["#efd057", "#ffae9b", "#28ebff", "#2a303c", "#b2ccd6"];
const dim: TThemePalette = {
  mode: "dark",
  colors: {
    primary: "#9fe88d",
    primaryContent: "#091307",
    background: "#2a303c",
    surfaceSunken: "#242933",
    border: "#1c212b",
    text: "#b2ccd6",
    textSecondary: "rgba(178, 204, 214, 0.6)",
    error: "#ffae9b",
    errorContent: "#160b09",
    success: "#62efbd",
    successContent: "#03140d",
    priority: DIM_PRIORITY,
    priorityMuted: mutePriorities(DIM_PRIORITY, "#2a303c", "#242933"),
    priorityContent: ["#141003", "#160b09", "#011316", "#b2ccd6", "#2a303c"],
  },
};

const DARK_PRIORITY = ["#fcb700", "#ff627d", "#00bafe", "#1d232a", "#ecf9ff"];
const dark: TThemePalette = {
  mode: "dark",
  colors: {
    primary: "#605dff",
    primaryContent: "#edf1fe",
    background: "#1d232a",
    surfaceSunken: "#191e24",
    border: "#15191e",
    text: "#ecf9ff",
    textSecondary: "rgba(236, 249, 255, 0.6)",
    error: "#ff627d",
    errorContent: "#4d0218",
    success: "#00d390",
    successContent: "#004c39",
    priority: DARK_PRIORITY,
    priorityMuted: mutePriorities(DARK_PRIORITY, "#1d232a", "#191e24"),
    priorityContent: ["#793205", "#4d0218", "#042e49", "#ecf9ff", "#1d232a"],
  },
};

const ABYSS_PRIORITY = ["#ffbf00", "#f04e4f", "#00bafe", "#001e29", "#ffd6a7"];
const abyss: TThemePalette = {
  mode: "dark",
  colors: {
    primary: "#bdff00",
    primaryContent: "#427600",
    background: "#001e29",
    surfaceSunken: "#00111d",
    border: "#000c15",
    text: "#ffd6a7",
    textSecondary: "rgba(255, 214, 167, 0.6)",
    error: "#f04e4f",
    errorContent: "#690000",
    success: "#01df72",
    successContent: "#022d14",
    priority: ABYSS_PRIORITY,
    priorityMuted: mutePriorities(ABYSS_PRIORITY, "#001e29", "#00111d"),
    priorityContent: ["#854200", "#690000", "#042e49", "#ffd6a7", "#001e29"],
  },
};

/** All selectable themes, keyed by the value stored in `preferences.light_theme` / `dark_theme`. */
export const themes: Record<string, TThemePalette> = {
  dexter,
  light,
  dim,
  dark,
  abyss,
};

/** Fallbacks when a stored theme name is missing or unknown. */
const DEFAULT_LIGHT_THEME = "dexter";
const DEFAULT_DARK_THEME = "dark";

export type TThemeMeta = {
  name: string;
  label: string;
  mode: "light" | "dark";
};

/**
 * The Appearance picker's themes. `mode` is read off the palette, so the picker
 * can't group a theme under one heading while `useTheme().mode` reports the other.
 */
export const THEMES: TThemeMeta[] = [
  { name: "dexter", label: "Dexter", mode: dexter.mode },
  { name: "light", label: "Light", mode: light.mode },
  { name: "dim", label: "Dim", mode: dim.mode },
  { name: "dark", label: "Dark", mode: dark.mode },
  { name: "abyss", label: "Abyss", mode: abyss.mode },
];

// useLayoutEffect logs a warning when there is no DOM, so fall back to
// useEffect off-client. On the client it fires before paint.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Web's first render has no reliable `prefers-color-scheme`, so render `light`
 * and resolve in a layout effect (before paint — no flash). Native is immediate.
 */
export function useResolvedColorScheme(): "light" | "dark" {
  const systemScheme = useColorScheme();
  const [resolved, setResolved] = useState(Platform.OS !== "web");
  useIsomorphicLayoutEffect(() => setResolved(true), []);

  if (!resolved) return "light";
  return systemScheme === "dark" ? "dark" : "light";
}

/** The subset of preferences that drives theme resolution. */
type TThemePreferences = {
  themeMode: EThemeMode;
  lightTheme: string;
  darkTheme: string;
};

/**
 * `SYSTEM` follows the OS; `LIGHT`/`DARK` force it; unknown names fall back per
 * scheme. Pure and density-free — screen size doesn't change *which* theme.
 */
export function resolveTheme(
  preferences: TThemePreferences,
  systemScheme: "light" | "dark",
): TThemePalette {
  const scheme =
    preferences.themeMode === EThemeMode.LIGHT
      ? "light"
      : preferences.themeMode === EThemeMode.DARK
        ? "dark"
        : systemScheme;

  const name =
    scheme === "dark" ? preferences.darkTheme : preferences.lightTheme;
  const fallback =
    scheme === "dark"
      ? themes[DEFAULT_DARK_THEME]
      : themes[DEFAULT_LIGHT_THEME];

  return themes[name] ?? fallback;
}

/**
 * Supplied by `ThemeProvider`; `null` outside one (root layout, unauthenticated
 * screens, tests), where `useTheme` falls back to an OS-driven default.
 */
export const ThemeContext = createContext<TThemePalette | null>(null);

/**
 * Palette + density tier. Density keys off `useIsLargeDevice` so a test mocking
 * the breakpoint gets the tier free (jest-expo mocks RN dimensions poorly).
 */
export function useTheme(): Theme {
  const provided = useContext(ThemeContext);
  const scheme = useResolvedColorScheme();
  const isLargeDevice = useIsLargeDevice();

  const palette =
    provided ??
    (scheme === "dark"
      ? themes[DEFAULT_DARK_THEME]
      : themes[DEFAULT_LIGHT_THEME]);
  // Compact is a *pointer* tier, not a width tier (DEX-61): its 26dp controls
  // sit under iOS's 44pt tap target, so native stays comfortable at every width.
  const density: TDensity =
    isLargeDevice && Platform.OS === "web" ? "compact" : "comfortable";

  return useMemo(
    () => ({ colors: palette.colors, mode: palette.mode, ...DENSITY[density] }),
    [palette, density],
  );
}

/**
 * Tailwind's shadow-md/lg. Black, not `colors.text` — ink-derived shadows halo
 * on dark themes (docs/design.md). The CSS string parses on native (RN 0.86).
 */
export const SHADOW_MD =
  "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)";
export const SHADOW_LG =
  "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)";

/**
 * Tailwind's shadow-2xl, for screen-sized surfaces: blur and alpha must scale
 * with the shape — `SHADOW_LG` across the Horoscope card read as nothing.
 */
export const SHADOW_2XL = "0 25px 50px -12px rgb(0 0 0 / 0.25)";

/**
 * Alpha for `#rrggbb` or `rgba(...)` input (multiplies an existing alpha, as CSS
 * nests opacity). For a tinted *surface* prefer a pre-blended token instead.
 */
export function withOpacity(color: string, alpha: number): string {
  const rgbaMatch = color.match(
    /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/,
  );
  if (rgbaMatch) {
    const [, r, g, b, existingAlpha] = rgbaMatch;
    const combinedAlpha = (existingAlpha ? Number(existingAlpha) : 1) * alpha;
    return `rgba(${r}, ${g}, ${b}, ${combinedAlpha})`;
  }

  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
