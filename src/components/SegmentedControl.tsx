import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Icon } from "@/components/Icon";
import type { TIconName } from "@/components/Icon.types";
import { useTheme } from "@/utils/theme";

export type TSegmentedControlOption<T extends string | number> = {
  label: string;
  value: T;
  /** Drawn in place of the label, which becomes the a11y name. No current
   * caller uses it — Ritual's icon segments were its one consumer (DEX-200). */
  icon?: TIconName;
};

type TSegmentedControlProps<T extends string | number> = {
  options: TSegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Each segment gets `${testIDPrefix}-${lowercased label}`. */
  testIDPrefix?: string;
};

// A row of mutually exclusive options, selected one filled with primary.
// Used by appearance mode and the create-task switch (DEX-65).
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  testIDPrefix,
}: TSegmentedControlProps<T>) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.segmented,
        {
          backgroundColor: theme.colors.surfaceSunken,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.md,
          gap: theme.space.xs,
          padding: theme.space.xs,
        },
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const contentColor = selected
          ? theme.colors.primaryContent
          : theme.colors.text;
        return (
          <TouchableOpacity
            key={option.value}
            // Only meaningful on an icon segment with no text fallback;
            // harmless (identical to rendered text) on a labelled one.
            accessibilityLabel={option.label}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              {
                backgroundColor: selected
                  ? theme.colors.primary
                  : "transparent",
                // Inset by the track's own padding so the nested corner stays
                // concentric with it — the app's one derived radius.
                borderRadius: theme.radii.md - theme.space.xs,
                paddingVertical: theme.space.sm,
                // An icon segment carries no text to give it width, so it pads
                // out to a tappable box of its own.
                paddingHorizontal: option.icon ? theme.space.sm : 0,
              },
            ]}
            testID={
              testIDPrefix
                ? `${testIDPrefix}-${option.label.toLowerCase()}`
                : undefined
            }
          >
            {option.icon ? (
              <Icon
                color={contentColor}
                ionicon={option.icon.ionicon}
                sf={option.icon.sf}
                size={theme.icons.md}
              />
            ) : (
              <Text style={{ ...theme.fonts.body, color: contentColor }}>
                {option.label}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  segmented: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
  },
});
