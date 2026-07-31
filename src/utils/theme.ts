import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { Platform, useColorScheme } from "react-native";

import { EThemeMode } from "@/api/preferences";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";

/**
 * The color half of a theme. Varies by the theme the user picked; never by
 * screen size. See `docs/design.md` for what belongs on each surface.
 */
export interface TThemeColors {
  primary: string;
  primaryContent: string;
  /** The main content surface — screen bodies, panes, the sheet behind cards. */
  background: string;
  /** Elevated on top of `background` — cards, inputs, stack headers, nav tiles. */
  card: string;
  /**
   * Sunken *below* `background` — the nav rail, the web dock, and the settings
   * sidebar. Chrome that should recede behind the content it sits beside
   * (DEX-61); everything else belongs on `background` or `card`.
   */
  surfaceSunken: string;
  /**
   * Hairline borders and dividers. Opaque and tuned per theme rather than an
   * alpha of `text`: a single alpha that reads correctly on light surfaces is
   * invisible on dark ones (DEX-61), so light themes get a border darker than
   * their surface and dark themes get one lighter than theirs.
   */
  border: string;
  text: string;
  textSecondary: string;
  error: string;
  errorContent: string;
  success: string;
  successContent: string;
  /**
   * Task priority accent colors, indexed by `ETaskPriority` (`api/tasks.ts`):
   * [IMPORTANT_AND_URGENT, URGENT, IMPORTANT, NEITHER, UNPRIORITIZED]. Ported
   * from dexter-app's `cardColors` (`src/components/Card.tsx`), which maps
   * those same priorities to the daisyUI `warning` / `error` / `info` /
   * `base-100` / `neutral` tokens respectively.
   *
   * These are the full-strength accents — dots, bars, badges, and the overdue
   * due-date pill. For the card *fill*, use `priorityMuted`.
   */
  priority: string[];
  /**
   * Solid card fills, indexed the same way. Each is the matching `priority`
   * accent pre-blended over this theme's `background` at
   * `CARD_FILL_ALPHA` — the tint task cards used to composite at render time.
   * Pre-blending makes the fill opaque, so a card no longer shifts color when
   * it sits over a pane that isn't `background` (DEX-61).
   */
  priorityMuted: string[];
  /** Text color readable on top of the matching `priority` color (the daisyUI tokens' `-content` pair). */
  priorityContent: string[];
}

/** A selectable theme. Density tokens are composed in by `useTheme`, not stored here. */
export type TThemePalette = { colors: TThemeColors };

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
    /** Metadata, section titles, timestamps. */
    caption: TFont<"600">;
    /** Default body copy — task titles, row labels. */
    body: TFont<"400">;
    /** Emphasized rows, buttons, primary labels. */
    title: TFont<"600">;
    /** Screen and detail-pane headings. */
    heading: TFont<"700">;
    /** The login splash only. */
    display: TFont<"900">;
  };
  /**
   * `md` is the app's one corner radius — cards, inputs, panes, tiles, buttons
   * all share it. `full` is for shapes that are meant to be circles or pills
   * (status buttons, priority pills, habit tiles) and is deliberately not a
   * point on the radius scale.
   */
  radii: { md: number; full: number };
  /** Diameters for round tap targets. `md` = icon buttons and tiles, `sm` = inline controls. */
  controls: { md: number; sm: number };
  /**
   * Glyph sizes. Kept separate from `fonts` because an icon's optical size
   * doesn't track the type it sits beside — a 20pt icon reads as the peer of a
   * 16pt label. `sm` = inline affordances (chevrons, menu glyphs), `md` = a
   * row's or nav item's leading icon.
   */
  icons: { sm: number; md: number };
}

export interface Theme extends TDensityTokens {
  colors: TThemeColors;
}

/**
 * How dense the numeric tokens are. `compact` applies on **web** at and above
 * `LARGE_DEVICE_MIN_WIDTH`, where the phone-tuned sizing read noticeably too
 * large and bold next to the legacy app (DEX-61). Native stays `comfortable` at
 * every width — see `useTheme` for why.
 */
export type TDensity = "comfortable" | "compact";

/**
 * Both tiers are written out in full rather than derived from a multiplier:
 * spacing wants to tighten harder than type does (a scaled-down caption stops
 * being legible well before the padding stops being roomy), and literals keep
 * every value an integer and reviewable against `docs/design.md`.
 */
export const DENSITY: Record<TDensity, TDensityTokens> = {
  comfortable: {
    space: { xs: 4, sm: 8, md: 16, lg: 24 },
    fonts: {
      caption: { fontSize: 12, fontWeight: "600" },
      body: { fontSize: 14, fontWeight: "400" },
      title: { fontSize: 16, fontWeight: "600" },
      heading: { fontSize: 24, fontWeight: "700" },
      display: { fontSize: 40, fontWeight: "900" },
    },
    radii: { md: 12, full: 999 },
    controls: { md: 40, sm: 32 },
    icons: { sm: 14, md: 20 },
  },
  compact: {
    space: { xs: 3, sm: 6, md: 12, lg: 18 },
    fonts: {
      caption: { fontSize: 11, fontWeight: "600" },
      body: { fontSize: 13, fontWeight: "400" },
      title: { fontSize: 14, fontWeight: "600" },
      heading: { fontSize: 20, fontWeight: "700" },
      display: { fontSize: 32, fontWeight: "900" },
    },
    // Corner radius is a brand constant, not a density one — a card reads as
    // the same card on both tiers, just a smaller one.
    radii: { md: 12, full: 999 },
    controls: { md: 32, sm: 26 },
    icons: { sm: 12, md: 18 },
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

/** Pre-blends a theme's priority accents into the solid card fills. */
const mutePriorities = (priority: string[], background: string): string[] =>
  priority.map((color) => blend(color, background, CARD_FILL_ALPHA));

// Each theme is a daisyUI theme ported oklch → hex. The TThemeColors fields map
// onto daisyUI tokens as: background = base-200, card = base-100,
// surfaceSunken = base-300, text = base-content, primary/error/success = the
// matching token + its `-content` pair, and the priority arrays =
// [warning, error, info, base-100, neutral] with their `-content` pairs.
// `border` is the exception: daisyUI has no border token, and base-300 would be
// darker than the surface in a dark theme — i.e. invisible — so each theme
// supplies one tuned to sit *against* its own surface. "dexter" is Dexter's
// custom brand theme (green primary on a warm base); the rest are faithful
// ports of the daisyUI themes of the same name.
const DEXTER_PRIORITY = ["#fcb700", "#ff627d", "#00bafe", "#fffbf4", "#593d31"];
const dexter: TThemePalette = {
  colors: {
    primary: "#00674f",
    primaryContent: "#c3ffcf",
    background: "#f7f1e7",
    card: "#fffbf4",
    surfaceSunken: "#efe7d9",
    border: "#e0d5c2",
    text: "#593d31",
    textSecondary: "rgba(89, 61, 49, 0.6)",
    error: "#ff627d",
    errorContent: "#4d0218",
    success: "#00d390",
    successContent: "#004c39",
    priority: DEXTER_PRIORITY,
    priorityMuted: mutePriorities(DEXTER_PRIORITY, "#f7f1e7"),
    priorityContent: ["#793205", "#4d0218", "#042e49", "#593d31", "#fffbf4"],
  },
};

const LIGHT_PRIORITY = ["#fcb700", "#ff627d", "#00bafe", "#ffffff", "#09090b"];
const light: TThemePalette = {
  colors: {
    primary: "#422ad5",
    primaryContent: "#e0e7ff",
    background: "#f8f8f8",
    card: "#ffffff",
    surfaceSunken: "#ededed",
    border: "#e0e0e0",
    text: "#18181b",
    textSecondary: "rgba(24, 24, 27, 0.6)",
    error: "#ff627d",
    errorContent: "#4d0218",
    success: "#00d390",
    successContent: "#004c39",
    priority: LIGHT_PRIORITY,
    priorityMuted: mutePriorities(LIGHT_PRIORITY, "#f8f8f8"),
    priorityContent: ["#793205", "#4d0218", "#042e49", "#18181b", "#e4e4e7"],
  },
};

// daisyUI "dim" — muted dark accents (the look DEX-23 shipped as the app's
// original single dark theme).
const DIM_PRIORITY = ["#efd057", "#ffae9b", "#28ebff", "#2a303c", "#1c212b"];
const dim: TThemePalette = {
  colors: {
    primary: "#9fe88d",
    primaryContent: "#091307",
    background: "#242933",
    card: "#2a303c",
    surfaceSunken: "#1c212b",
    border: "#3a4150",
    text: "#b2ccd6",
    textSecondary: "rgba(178, 204, 214, 0.6)",
    error: "#ffae9b",
    errorContent: "#160b09",
    success: "#62efbd",
    successContent: "#03140d",
    priority: DIM_PRIORITY,
    priorityMuted: mutePriorities(DIM_PRIORITY, "#242933"),
    priorityContent: ["#141003", "#160b09", "#011316", "#b2ccd6", "#b2ccd6"],
  },
};

const DARK_PRIORITY = ["#fcb700", "#ff627d", "#00bafe", "#1d232a", "#09090b"];
const dark: TThemePalette = {
  colors: {
    primary: "#605dff",
    primaryContent: "#edf1fe",
    background: "#191e24",
    card: "#1d232a",
    surfaceSunken: "#15191e",
    border: "#2f363d",
    text: "#ecf9ff",
    textSecondary: "rgba(236, 249, 255, 0.6)",
    error: "#ff627d",
    errorContent: "#4d0218",
    success: "#00d390",
    successContent: "#004c39",
    priority: DARK_PRIORITY,
    priorityMuted: mutePriorities(DARK_PRIORITY, "#191e24"),
    priorityContent: ["#793205", "#4d0218", "#042e49", "#ecf9ff", "#e4e4e7"],
  },
};

const ABYSS_PRIORITY = ["#ffbf00", "#f04e4f", "#00bafe", "#001e29", "#003843"];
const abyss: TThemePalette = {
  colors: {
    primary: "#bdff00",
    primaryContent: "#427600",
    background: "#00111d",
    card: "#001e29",
    surfaceSunken: "#000c15",
    border: "#0a3542",
    text: "#ffd6a7",
    textSecondary: "rgba(255, 214, 167, 0.6)",
    error: "#f04e4f",
    errorContent: "#690000",
    success: "#01df72",
    successContent: "#022d14",
    priority: ABYSS_PRIORITY,
    priorityMuted: mutePriorities(ABYSS_PRIORITY, "#00111d"),
    priorityContent: ["#854200", "#690000", "#042e49", "#ffd6a7", "#ffd6a7"],
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

/** Themes offered in the Appearance picker, grouped by the mode they belong to. */
export const THEMES: TThemeMeta[] = [
  { name: "dexter", label: "Dexter", mode: "light" },
  { name: "light", label: "Light", mode: "light" },
  { name: "dim", label: "Dim", mode: "dark" },
  { name: "dark", label: "Dark", mode: "dark" },
  { name: "abyss", label: "Abyss", mode: "dark" },
];

// useLayoutEffect logs a warning when there is no DOM, so fall back to
// useEffect off-client. On the client it fires before paint.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Hydration-safe color scheme resolution.
 *
 * On web the first render has no reliable `prefers-color-scheme` signal, so
 * render `light` first and resolve the real scheme in a layout effect (before
 * paint, so there is no visible flash). Native resolves immediately.
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
 * Resolves the active palette from the user's preferences and the OS color
 * scheme. `SYSTEM` mode follows the OS; `LIGHT`/`DARK` force the scheme. An
 * unknown stored theme name falls back to the default for the resolved scheme.
 *
 * Deliberately pure and density-free — screen size doesn't change *which*
 * theme is active, so `useTheme` composes the density tokens on top.
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
 * Holds the palette resolved from the user's saved preferences. Supplied by
 * `ThemeProvider` (mounted inside the auth + query providers). `null` outside a
 * provider — e.g. the root layout above those providers, unauthenticated
 * screens, or tests — where `useTheme` falls back to an OS-driven default.
 */
export const ThemeContext = createContext<TThemePalette | null>(null);

/**
 * The active theme: the user's palette plus the density tier for this screen.
 *
 * Density keys off `useIsLargeDevice` rather than `useWindowDimensions`
 * directly, so a test that already mocks the breakpoint gets the matching tier
 * for free (and jest-expo doesn't mock RN's dimensions hook cleanly).
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
  // Compact is a *pointer* tier, not a width tier. It exists because the
  // phone-tuned sizing read noticeably too large next to the legacy desktop web
  // app (DEX-61) — a mouse-at-a-desk problem, where a cursor hits a 26dp target
  // as easily as a 40dp one. A large touch device has the width but not the
  // input: `controls.sm` at 26dp is well under the 44pt iOS minimum tap target,
  // so an iPad on this tier reads cramped rather than refined. Native therefore
  // stays comfortable at every width, and `compact` is web-only.
  const density: TDensity =
    isLargeDevice && Platform.OS === "web" ? "compact" : "comfortable";

  return useMemo(
    () => ({ colors: palette.colors, ...DENSITY[density] }),
    [palette, density],
  );
}

/**
 * Applies an alpha channel to a color, e.g. for a scrim or to dim content
 * without fading the surface under it. Accepts a `#rrggbb` hex color or an
 * existing `rgba(...)` string — in the latter case, `alpha` multiplies the
 * color's existing alpha, matching how nested opacity modifiers compose in CSS.
 *
 * For a tinted *surface*, prefer a pre-blended token (`colors.priorityMuted`):
 * an alpha fill takes on whatever is behind it.
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
