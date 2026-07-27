import { render } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

// Shared by the Today-tab surfaces' tests. The project-wide
// react-native-safe-area-context mock (jest.setup.js) resolves
// `useSafeAreaInsets()` against the real SafeAreaInsetsContext and falls back
// to all-zero insets, so a test that cares about the inset can supply one
// through the context rather than re-mocking the module per file — the same
// mechanism TaskDrawerSheet uses in production to zero the inset inside the
// sheet. Sibling of `mockSafeAreaEdges`, which covers the other half of the
// convention (which `edges` a screen's SafeAreaView claims).
export const renderWithBottomInset = (bottom: number, ui: ReactElement) =>
  render(
    <SafeAreaInsetsContext.Provider
      value={{ top: 0, right: 0, bottom, left: 0 }}
    >
      {ui}
    </SafeAreaInsetsContext.Provider>,
  );
