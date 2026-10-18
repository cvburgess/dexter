import { render } from "@testing-library/react-native";
import type { ReactElement, ReactNode } from "react";
import type { EdgeInsets } from "react-native-safe-area-context";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

// Supplies insets via context rather than re-mocking per file. Passed as
// RTL's `wrapper`, not around `ui` directly, so rerender() keeps the provider.
export const renderWithInsets = (
  insets: Partial<EdgeInsets>,
  ui: ReactElement,
) =>
  render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0, ...insets }}
      >
        {children}
      </SafeAreaInsetsContext.Provider>
    ),
  });

/** The bottom-inset-only case; use {@link renderWithInsets} for more edges. */
export const renderWithBottomInset = (bottom: number, ui: ReactElement) =>
  renderWithInsets({ bottom }, ui);
