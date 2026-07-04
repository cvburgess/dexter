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
     * [IMPORTANT_AND_URGENT, URGENT, IMPORTANT, NEITHER, UNPRIORITIZED].
     */
    priority: string[];
    /** Text color readable on top of the matching `priority` color. */
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
    priority: ["#f5a623", "#ff627d", "#4a90d9", "#9aa0a6", "#d8d3c8"],
    priorityContent: ["#4d3300", "#4d0218", "#0d2b47", "#2b2e31", "#593d31"],
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
    priority: ["#f5a623", "#ff627d", "#4a90d9", "#9aa0a6", "#454b52"],
    priorityContent: ["#3a2700", "#4d0218", "#0a1f33", "#1c1e20", "#ecf9ff"],
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

/** Applies an alpha channel to a `#rrggbb` color, e.g. for a tinted background that doesn't fade its content. */
export function withOpacity(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
