import { render } from "@testing-library/react-native";
import type { ReactElement, ReactNode } from "react";
import type { EdgeInsets } from "react-native-safe-area-context";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

// Shared by the Today-tab surfaces' and the nav rail's tests. The project-wide
// react-native-safe-area-context mock (jest.setup.js) resolves
// `useSafeAreaInsets()` against the real SafeAreaInsetsContext and falls back
// to all-zero insets, so a test that cares about an inset can supply one
// through the context rather than re-mocking the module per file — the same
// mechanism TaskDrawerSheet uses in production to zero the inset inside the
// sheet. Sibling of `mockSafeAreaEdges`, which covers the other half of the
// convention (which `edges` a screen's SafeAreaView claims).
//
// Passed as RTL's `wrapper` rather than wrapped around `ui` directly, so a
// `rerender(...)` from the returned screen keeps the provider instead of
// re-rendering the subject with the mock's default all-zero insets.
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

/**
 * The bottom-inset-only case, which is most of them: a screen reserving room
 * for the home indicator. Delegates to `renderWithInsets` for anything that
 * needs more than one edge — the nav rail claims three.
 */
export const renderWithBottomInset = (bottom: number, ui: ReactElement) =>
  renderWithInsets({ bottom }, ui);
