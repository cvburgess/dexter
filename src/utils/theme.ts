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
   * `base-100`) — screen bodies, panes, the sheet behind cards, and the nav
   * rail's tiles. Content is the brightest plane in the app; everything that
   * frames it recedes to `surfaceSunken`.
   */
  background: string;
  /**
   * Sunken *below* `background` (daisyUI `base-200`) — cards, inputs, rows,
   * menus, and the web nav rail and dock. Anything that frames or holds
   * content rather than being content (DEX-61).
   */
  surfaceSunken: string;
  /**
   * Hairline borders and dividers, always a step *darker* than the surfaces
   * above — dark themes included, where the line is drawn by taking light away
   * rather than adding it. Opaque and tuned per theme rather than an alpha of
   * `text`: a single alpha that reads correctly on a light surface is invisible
   * on a dark one (DEX-61).
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
   * `UNPRIORITIZED` is the one slot that does **not** take its daisyUI token:
   * it is always this theme's `text`, the app's ink (DEX-114). See the palette
   * notes below `mutePriorities` for why.
   *
   * These are the full-strength accents — dots, bars, badges, and the overdue
   * due-date pill. For the card *fill*, use `priorityMuted`.
   */
  priority: string[];
  /**
   * Solid card fills, indexed the same way. Each is the matching `priority`
   * accent pre-blended over this theme's `background` — the pane a card sits
   * on — at `CARD_FILL_ALPHA`, the alpha task cards used to composite at render
   * time. Pre-blending makes the fill opaque, so a card no longer shifts color
   * when it sits over a pane that isn't `background` (DEX-61).
   *
   * `NEITHER` is `surfaceSunken` rather than a blend — see `mutePriorities`.
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
    /** The second line under a `title` — a row's detail, a section's explanation. */
    subtitle: TFont<"400">;
    /** Default body copy — task titles, row labels, calendar event names. */
    body: TFont<"400">;
    /**
     * Interactive controls: buttons, text inputs, date/time pickers.
     *
     * **Never below 16 on `comfortable`.** iOS Safari zooms the page when a
     * focused input's font-size is under 16px, and `TextInput` has no `.web`
     * variant, so it renders on mobile web where `comfortable` applies. Split
     * from `title` (which carries the same values) precisely so tuning `title`
     * for density can't silently reintroduce that zoom.
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
 * spacing wants to tighten harder than type does (a scaled-down subtitle stops
 * being legible well before the padding stops being roomy), and literals keep
 * every value an integer and reviewable against `docs/design.md`.
 */
export const DENSITY: Record<TDensity, TDensityTokens> = {
  comfortable: {
    space: { xs: 4, sm: 8, md: 16, lg: 24 },
    fonts: {
      subtitle: { fontSize: 12, fontWeight: "400" },
      body: { fontSize: 14, fontWeight: "400" },
      control: { fontSize: 16, fontWeight: "600" },
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
      subtitle: { fontSize: 11, fontWeight: "400" },
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

/**
 * Pre-blends a theme's priority accents into the solid card fills.
 *
 * `NEITHER` is the exception and takes `surfaceSunken` outright: its accent
 * *is* `base-100`, so blending it over the `background` pane returns the pane
 * itself and a `NEITHER` card dissolved into whatever it sat on. Cards carry no
 * outline (DEX-114), so the fill is the only thing left to draw the card — it
 * has to be a surface the pane isn't.
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

// Each theme is a daisyUI theme ported oklch → hex. The TThemeColors fields map
// onto daisyUI tokens as: background = base-100, surfaceSunken = base-200,
// text = base-content, primary/error/success = the matching token + its
// `-content` pair, and the priority arrays = [warning, error, info, base-100,
// base-content] with their `-content` pairs. The two surfaces are anchored where
// dexter-app anchors them — content on base-100, chrome on base-200 — so the
// app reads at the same brightness as the legacy web app rather than a rung
// darker (DEX-61).
// `UNPRIORITIZED` is the other deviation from the port (DEX-114). daisyUI's
// `neutral` is a *dark* swatch on every theme, so on the dark themes an
// unprioritized card came out near-black against an already dark pane while the
// active nav tile — `withOpacity(text, 0.8)`, see `WebNav` — went light. The two
// are meant to be the same mark: a block of the app's ink with the surface
// showing through the type on it. dexter only got that right by accident, its
// `neutral` and `base-content` being the same brown. Taking `base-content`
// outright makes it hold on all five themes, and because the fill blends the
// ink at `CARD_FILL_ALPHA` (0.8) it lands on the tile's own 80% ink by
// construction rather than by coincidence.
// `border` is the exception: daisyUI has no border token, so the dark themes
// take base-300 (the step below chrome, and what dexter-app draws its own
// borders with) while the light themes go one step beyond theirs, since a light
// theme's base-300 is nearly its base-200. "dexter" is Dexter's
// custom brand theme (green primary on a warm base); the rest are faithful
// ports of the daisyUI themes of the same name.
const DEXTER_PRIORITY = ["#fcb700", "#ff627d", "#00bafe", "#fffbf4", "#593d31"];
const dexter: TThemePalette = {
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
