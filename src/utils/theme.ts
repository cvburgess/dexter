import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { Platform, useColorScheme } from "react-native";

import { EThemeMode } from "@/api/preferences";

export interface Theme {
  borderRadius: number;
  colors: {
    primary: string;
    primaryContent: string;
    background: string;
    card: string;
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
     */
    priority: string[];
    /** Text color readable on top of the matching `priority` color (the daisyUI tokens' `-content` pair). */
    priorityContent: string[];
  };
  fonts: {
    heading: {
      fontSize: number;
      fontWeight: "900";
    };
  };
  gap: number;
  spacing: number;
}

const baseTheme: Omit<Theme, "colors"> = {
  borderRadius: 12,
  fonts: {
    heading: {
      fontSize: 40,
      fontWeight: "900",
    },
  },
  gap: 12,
  spacing: 16,
};

// Each theme is a daisyUI theme ported oklch → hex. The Theme fields map onto
// daisyUI tokens as: background = base-200, card = base-100, text = base-content,
// primary/error/success = the matching token + its `-content` pair, and the
// priority arrays = [warning, error, info, base-100, neutral] with their
// `-content` pairs. "dexter" is Dexter's custom brand theme (green primary on a
// warm base); the rest are faithful ports of the daisyUI themes of the same name.
const dexter: Theme = {
  ...baseTheme,
  colors: {
    primary: "#00674f",
    primaryContent: "#c3ffcf",
    background: "#f7f1e7",
    card: "#fffbf4",
    text: "#593d31",
    textSecondary: "rgba(89, 61, 49, 0.6)",
    error: "#ff627d",
    errorContent: "#4d0218",
    success: "#00d390",
    successContent: "#004c39",
    priority: ["#fcb700", "#ff627d", "#00bafe", "#fffbf4", "#593d31"],
    priorityContent: ["#793205", "#4d0218", "#042e49", "#593d31", "#fffbf4"],
  },
};

const light: Theme = {
  ...baseTheme,
  colors: {
    primary: "#422ad5",
    primaryContent: "#e0e7ff",
    background: "#f8f8f8",
    card: "#ffffff",
    text: "#18181b",
    textSecondary: "rgba(24, 24, 27, 0.6)",
    error: "#ff627d",
    errorContent: "#4d0218",
    success: "#00d390",
    successContent: "#004c39",
    priority: ["#fcb700", "#ff627d", "#00bafe", "#ffffff", "#09090b"],
    priorityContent: ["#793205", "#4d0218", "#042e49", "#18181b", "#e4e4e7"],
  },
};

// daisyUI "dim" — muted dark accents (the look DEX-23 shipped as the app's
// original single dark theme).
const dim: Theme = {
  ...baseTheme,
  colors: {
    primary: "#9fe88d",
    primaryContent: "#091307",
    background: "#242933",
    card: "#2a303c",
    text: "#b2ccd6",
    textSecondary: "rgba(178, 204, 214, 0.6)",
    error: "#ffae9b",
    errorContent: "#160b09",
    success: "#62efbd",
    successContent: "#03140d",
    priority: ["#efd057", "#ffae9b", "#28ebff", "#2a303c", "#1c212b"],
    priorityContent: ["#141003", "#160b09", "#011316", "#b2ccd6", "#b2ccd6"],
  },
};

const dark: Theme = {
  ...baseTheme,
  colors: {
    primary: "#605dff",
    primaryContent: "#edf1fe",
    background: "#191e24",
    card: "#1d232a",
    text: "#ecf9ff",
    textSecondary: "rgba(236, 249, 255, 0.6)",
    error: "#ff627d",
    errorContent: "#4d0218",
    success: "#00d390",
    successContent: "#004c39",
    priority: ["#fcb700", "#ff627d", "#00bafe", "#1d232a", "#09090b"],
    priorityContent: ["#793205", "#4d0218", "#042e49", "#ecf9ff", "#e4e4e7"],
  },
};

const abyss: Theme = {
  ...baseTheme,
  colors: {
    primary: "#bdff00",
    primaryContent: "#427600",
    background: "#00111d",
    card: "#001e29",
    text: "#ffd6a7",
    textSecondary: "rgba(255, 214, 167, 0.6)",
    error: "#f04e4f",
    errorContent: "#690000",
    success: "#01df72",
    successContent: "#022d14",
    priority: ["#ffbf00", "#f04e4f", "#00bafe", "#001e29", "#003843"],
    priorityContent: ["#854200", "#690000", "#042e49", "#ffd6a7", "#ffd6a7"],
  },
};

/** All selectable themes, keyed by the value stored in `preferences.light_theme` / `dark_theme`. */
export const themes: Record<string, Theme> = {
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
 * Resolves the active theme from the user's preferences and the OS color
 * scheme. `SYSTEM` mode follows the OS; `LIGHT`/`DARK` force the scheme. An
 * unknown stored theme name falls back to the default for the resolved scheme.
 */
export function resolveTheme(
  preferences: TThemePreferences,
  systemScheme: "light" | "dark",
): Theme {
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
 * Holds the theme resolved from the user's saved preferences. Supplied by
 * `ThemeProvider` (mounted inside the auth + query providers). `null` outside a
 * provider — e.g. the root layout above those providers, unauthenticated
 * screens, or tests — where `useTheme` falls back to an OS-driven default.
 */
export const ThemeContext = createContext<Theme | null>(null);

export function useTheme(): Theme {
  const provided = useContext(ThemeContext);
  const scheme = useResolvedColorScheme();
  return (
    provided ??
    (scheme === "dark"
      ? themes[DEFAULT_DARK_THEME]
      : themes[DEFAULT_LIGHT_THEME])
  );
}

/**
 * Applies an alpha channel to a color, e.g. for a tinted background that
 * doesn't fade its content. Accepts a `#rrggbb` hex color or an existing
 * `rgba(...)` string — in the latter case, `alpha` multiplies the color's
 * existing alpha, matching how nested opacity modifiers compose in CSS.
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
