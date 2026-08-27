import { NativeTabs } from "expo-router/unstable-native-tabs";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { TFocusBlock } from "@/api/focusBlocks";
import { FocusCountdown } from "@/components/FocusCountdown";
import { Icon } from "@/components/Icon";
import { TFocusTimerActions } from "@/hooks/useFocusTimer";
import { useTheme } from "@/utils/theme";

/** iOS bottom accessory, replacing "＋ New Task". **Instantiated twice**
 * (regular + inline) — takes props, never an effect that writes. */
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
        // Minimized: countdown and pause take the two ends, control under
        // the thumb, rather than huddling at the leading edge.
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
  // name is what truncates. Centred in the space it is left, matching the bar.
  title: {
    flex: 1,
    textAlign: "center",
  },
});
