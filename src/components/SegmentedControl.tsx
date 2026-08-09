import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Icon } from "@/components/Icon";
import type { TIconName } from "@/components/Icon.types";
import { useTheme } from "@/utils/theme";

export type TSegmentedControlOption<T extends string | number> = {
  label: string;
  value: T;
  /**
   * Drawn in place of the label, with the label becoming the segment's
   * accessibility name. For a control that has to sit in a toolbar rather than
   * span a form, where six words would not fit but six glyphs do (DEX-127).
   */
  icon?: TIconName;
};

type TSegmentedControlProps<T extends string | number> = {
  options: TSegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Each segment gets `${testIDPrefix}-${lowercased label}`. */
  testIDPrefix?: string;
  /**
   * Whether the segments divide the full width of their container (the
   * default, which is what a form row wants) or size to their own content —
   * required in a toolbar, where the row has no width of its own for `flex: 1`
   * segments to divide and they would collapse to nothing.
   */
  stretch?: boolean;
};

/**
 * A row of mutually exclusive options, the selected one filled with the theme's
 * primary. Used for the appearance screen's light/dark mode, the create-task
 * modal's New/Template/AI switch (DEX-65), and the Ritual toolbar's step picker
 * (DEX-127, the icon form).
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  testIDPrefix,
  stretch = true,
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
            // Only meaningful on an icon segment, where there is no text for a
            // screen reader to fall back to; harmless (and identical to the
            // rendered text) on a labelled one.
            accessibilityLabel={option.label}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              stretch ? styles.stretched : null,
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
    justifyContent: "center",
  },
  stretched: {
    flex: 1,
  },
  segmented: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
  },
});
