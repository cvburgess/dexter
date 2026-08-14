import { NativeTabs } from "expo-router/unstable-native-tabs";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { TFocusBlock } from "@/api/focusBlocks";
import { FocusCountdown } from "@/components/FocusCountdown";
import { Icon } from "@/components/Icon";
import { TFocusTimerActions } from "@/hooks/useFocusTimer";
import { useTheme } from "@/utils/theme";

/**
 * The running focus block as the iOS tab bar's bottom accessory (iOS 26+),
 * taking the capsule "＋ New Task" otherwise fills.
 *
 * **This component is instantiated twice at once** — react-native-screens
 * renders the accessory once for the `regular` placement and once for `inline`
 * (see `useFocusTimer.tsx`). So it takes its block and its controls as props
 * from the module store rather than calling the query hooks, and it must never
 * gain an effect that writes: that write would fire twice.
 *
 * The inline placement is the strip beside a minimized tab bar and has room for
 * the countdown and one control, so it keeps the one that is about the timer —
 * pushed to the far edge, where a thumb already is.
 *
 * There is deliberately **no create-task button here**, even though the
 * accessory is a phone's only one: a block is 25 minutes of not adding to the
 * list, and the button is back the moment it ends.
 */
export function FocusTimerAccessory({
  actions,
  block,
}: {
  actions: TFocusTimerActions;
  block: TFocusBlock;
}) {
  const theme = useTheme();
  const placement = NativeTabs.BottomAccessory.usePlacement();

  const isInline = placement === "inline";
  const isRunning = block.status === "active";

  return (
    <View
      style={[
        styles.accessory,
        {
          backgroundColor: theme.colors.primary,
          borderRadius: theme.radii.full,
          gap: theme.space.sm,
          paddingHorizontal: theme.space.md,
        },
        // Minimized, the countdown and the pause control are the only two
        // things here, so they take the two ends rather than huddling at the
        // leading edge — the control lands under the thumb.
        isInline ? styles.inline : null,
      ]}
    >
      <FocusCountdown
        block={block}
        style={[
          isInline ? theme.fonts.body : theme.fonts.control,
          { color: theme.colors.primaryContent },
        ]}
      />
      {isInline ? null : (
        <Text
          numberOfLines={1}
          style={[
            theme.fonts.body,
            styles.title,
            { color: theme.colors.primaryContent },
          ]}
        >
          {block.tasks.title}
        </Text>
      )}
      <TouchableOpacity
        accessibilityLabel={
          isRunning ? "Pause focus block" : "Resume focus block"
        }
        accessibilityRole="button"
        onPress={() =>
          isRunning
            ? actions.pauseFocusBlock(block)
            : actions.resumeFocusBlock(block)
        }
      >
        <Icon
          color={theme.colors.primaryContent}
          ionicon={isRunning ? "pause" : "play"}
          sf={isRunning ? "pause.fill" : "play.fill"}
        />
      </TouchableOpacity>
      {isInline ? null : (
        <TouchableOpacity
          accessibilityLabel="Stop focus block"
          accessibilityRole="button"
          onPress={() => actions.cancelFocusBlock(block)}
        >
          <Icon
            color={theme.colors.primaryContent}
            ionicon="stop"
            sf="stop.fill"
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  accessory: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
  },
  inline: {
    justifyContent: "space-between",
  },
  // Everything else in the row is fixed-width and load-bearing, so the task
  // name is what truncates.
  title: {
    flex: 1,
  },
});
