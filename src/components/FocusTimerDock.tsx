import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FocusTimerBar } from "@/components/FocusTimerBar";
import { ANDROID_TAB_BAR_HEIGHT } from "@/utils/breakpoints";
import { IS_TABLET } from "@/utils/deviceType";
import { useTheme } from "@/utils/theme";

/**
 * The focus timer bar for **Android phones**, and only those (DEX-49).
 *
 * Every other surface has somewhere to put the bar in the layout itself: iOS
 * phones host it in the tab bar's bottom accessory, and tablets and web mount it
 * in `AppShell` as a flex sibling of the tab content. An Android phone has
 * neither — `NativeTabs` there offers no bottom accessory (iOS 26+ only) and it
 * gets no rail or dock — so without this the timer could be *started* from a
 * task's menu and then never seen, paused, or stopped again.
 *
 * So this is the one absolutely-positioned overlay in the feature, and it stays
 * scoped to the platform that needs it. `box-none` lets touches through
 * everywhere except the bar itself, and the bar renders `null` with no live
 * block, so the whole thing is inert the rest of the time.
 */
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
