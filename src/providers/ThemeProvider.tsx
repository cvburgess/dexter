import { ReactNode } from "react";

import { usePreferences } from "@/hooks/usePreferences";
import {
  ThemeContext,
  resolveTheme,
  useResolvedColorScheme,
} from "@/utils/theme";

// Must be mounted inside the auth + query providers, since usePreferences
// reads both.
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [preferences] = usePreferences();
  const systemScheme = useResolvedColorScheme();

  const theme = resolveTheme(preferences, systemScheme);

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
};
