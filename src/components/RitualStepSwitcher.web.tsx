import { StyleSheet, View } from "react-native";

import { GlassIconButton } from "@/components/GlassIconButton";
import { ritualStepOptions } from "@/components/RitualStepSwitcher.shared";
import type { TRitualStepSwitcherProps } from "@/components/RitualStepSwitcher.types";
import { useTheme } from "@/utils/theme";

/**
 * The ritual's step switcher on web: one round button per step, the current one
 * tinted — `DayPaneToggles`' shape, and a progress indicator as much as a
 * control, since the whole ritual is visible at once.
 *
 * Not a menu, for two reasons. A browser window has the width to show every
 * step, so hiding them behind a trigger would spend a tap for nothing. And
 * `IconMenu.web` is the app's last React Native `Modal`: it portals into
 * `document.body`, outside the vaul dialog that renders `ritual-session`, where
 * a modal Radix dialog sets `pointer-events: none` on everything beyond its own
 * subtree — the menu would paint on top and silently swallow every click, the
 * same failure `ConfirmationModal.web` had (see docs/frontend.md).
 *
 * The row wraps: at a wide modal it sits beside `DayNav` on one line, and on a
 * narrow browser window — where six buttons and the date nav genuinely do not
 * fit together — it drops to a line of its own instead of squeezing the nav.
 */
export function RitualStepSwitcher({
  state,
  onSelectStep,
}: TRitualStepSwitcherProps) {
  const theme = useTheme();
  const options = ritualStepOptions(state, onSelectStep);

  return (
    <View style={[styles.row, { gap: theme.space.sm }]}>
      {options.map((option) => (
        <GlassIconButton
          key={option.index}
          accessibilityLabel={`Go to ${option.title.toLowerCase()}`}
          active={option.isCurrent}
          ionicon={option.icon.ionicon}
          onPress={option.onSelect}
          sfSymbol={option.icon.sf}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
  },
});
