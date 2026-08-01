import type { StyleProp, ViewStyle } from "react-native";
import type { Edge } from "react-native-safe-area-context";
import type { Edge as TScreensEdge } from "react-native-screens/experimental";

// Shared by Settings screens' two-pane tests. The project-wide
// react-native-safe-area-context mock (jest.setup.js) doesn't stub
// SafeAreaView itself, so `edges` isn't otherwise observable in a render
// tree — expose it via testID to assert on the two-pane/single-pane split.
// Call this from each test file's own `jest.mock("react-native-safe-area-context", ...)`
// factory so the override stays opt-in per file rather than changing the
// project-wide mock.
export const mockSafeAreaContext = () => {
  const actual = jest.requireActual(
    "react-native-safe-area-context/jest/mock",
  ).default;
  const { View } = require("react-native");
  return {
    ...actual,
    SafeAreaView: ({
      children,
      edges,
      style,
    }: {
      children: React.ReactNode;
      edges?: Edge[];
      style?: StyleProp<ViewStyle>;
    }) => (
      <View testID={`safe-area-edges-${(edges ?? []).join(",")}`} style={style}>
        {children}
      </View>
    ),
  };
};

// The same trick for `react-native-screens`' SafeAreaView, which the Search
// screen frames itself with instead — its insets come from the stack screen's
// own view, so they include the translucent header the search bar forces
// (DEX-107); the context provider's don't. Two mocks rather than one because the
// two components disagree about `edges`: an array there, a partial record here.
//
// The testID lists the claimed edges alphabetically, since a record has no
// meaningful order of its own.
export const mockScreensSafeArea = () => {
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    SafeAreaView: ({
      children,
      edges,
      style,
    }: {
      children: React.ReactNode;
      edges?: Readonly<Partial<Record<TScreensEdge, boolean>>>;
      style?: StyleProp<ViewStyle>;
    }) => {
      const claimed = Object.entries(edges ?? {})
        .filter(([, enabled]) => enabled)
        .map(([edge]) => edge)
        .sort();

      return (
        <View
          testID={`screen-safe-area-edges-${claimed.join(",")}`}
          style={style}
        >
          {children}
        </View>
      );
    },
  };
};
