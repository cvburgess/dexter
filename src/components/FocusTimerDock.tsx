import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FocusTimerBar } from "@/components/FocusTimerBar";
import { ANDROID_TAB_BAR_HEIGHT } from "@/utils/breakpoints";
import { IS_TABLET } from "@/utils/deviceType";
import { useTheme } from "@/utils/theme";

/** The bar for **Android phones only** (DEX-49) — they get no accessory,
 * rail, or dock otherwise, so a started block could never be stopped. */
export function FocusTimerDock() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  if (Platform.OS !== "android" || IS_TABLET) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.dock,
        {
          bottom: ANDROID_TAB_BAR_HEIGHT + insets.bottom,
          paddingHorizontal: theme.space.md,
        },
      ]}
    >
      <FocusTimerBar />
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    alignItems: "center",
    left: 0,
    position: "absolute",
    right: 0,
  },
});
