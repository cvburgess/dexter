import { useEffect, useLayoutEffect, useState } from "react";
import { Platform, useColorScheme } from "react-native";

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

// Brand colors converted from the daisyUI "dexter" theme (oklch → hex).
const lightTheme: Theme = {
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

const darkTheme: Theme = {
  ...baseTheme,
  colors: {
    primary: "#00674f",
    primaryContent: "#c3ffcf",
    background: "#191e24",
    card: "#1d232a",
    text: "#ecf9ff",
    textSecondary: "rgba(236, 249, 255, 0.6)",
    error: "#ff627d",
    errorContent: "#4d0218",
    success: "#00d390",
    successContent: "#004c39",
    // Priority accents in dark mode come from daisyUI's muted "dim" theme
    // (warning / error / info / base-100 / neutral, oklch → hex), matching how
    // dexter-app rendered dark mode. The light theme keeps the bolder "dexter"
    // theme accents above.
    priority: ["#efd057", "#ffae9b", "#28ebff", "#2a303c", "#1c212b"],
    priorityContent: ["#141003", "#160b09", "#011316", "#b2ccd6", "#b2ccd6"],
  },
};

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

export function useTheme(): Theme {
  return useResolvedColorScheme() === "dark" ? darkTheme : lightTheme;
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
