import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useTheme, withOpacity } from "@/utils/theme";

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
          backgroundColor: theme.colors.card,
          borderColor: withOpacity(theme.colors.text, 0.1),
          borderRadius: theme.borderRadius,
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
                borderRadius: theme.borderRadius - 4,
              },
            ]}
            testID={
              testIDPrefix
                ? `${testIDPrefix}-${option.label.toLowerCase()}`
                : undefined
            }
          >
            <Text
              style={[
                styles.segmentLabel,
                {
                  color: selected
                    ? theme.colors.primaryContent
                    : theme.colors.text,
                },
              ]}
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
    paddingVertical: 10,
  },
  segmentLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  segmented: {
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 4,
    padding: 4,
  },
});
