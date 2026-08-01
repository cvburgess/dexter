import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "@/utils/theme";

export type TSegmentedControlOption<T extends string | number> = {
  label: string;
  value: T;
};

type TSegmentedControlProps<T extends string | number> = {
  options: TSegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Each segment gets `${testIDPrefix}-${lowercased label}`. */
  testIDPrefix?: string;
};

/**
 * A row of mutually exclusive options, the selected one filled with the theme's
 * primary. Used for the appearance screen's light/dark mode and for the
 * create-task modal's New/Template/AI switch (DEX-65).
 */
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
        return (
          <TouchableOpacity
            key={option.value}
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
              },
            ]}
            testID={
              testIDPrefix
                ? `${testIDPrefix}-${option.label.toLowerCase()}`
                : undefined
            }
          >
            <Text
              style={{
                ...theme.fonts.body,
                color: selected
                  ? theme.colors.primaryContent
                  : theme.colors.text,
              }}
            >
              {option.label}
            </Text>
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
  },
  segmented: {
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
  },
});
