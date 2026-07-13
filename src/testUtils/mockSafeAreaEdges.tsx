import type { StyleProp, ViewStyle } from "react-native";
import type { Edge } from "react-native-safe-area-context";

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
