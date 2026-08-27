import type { StyleProp, ViewStyle } from "react-native";
import type { Edge } from "react-native-safe-area-context";
import type { Edge as TScreensEdge } from "react-native-screens/experimental";

// The project-wide safe-area mock doesn't stub SafeAreaView itself, so `edges`
// isn't observable; expose it via testID, opt-in per test file.
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

// Same trick for react-native-screens' SafeAreaView (DEX-107), whose insets
// include the header the search bar forces; `edges` is a record here, not an array.
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
