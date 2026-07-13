import { StyleSheet, Switch, Text, View } from "react-native";

import { useTheme, withOpacity } from "@/utils/theme";

type TSettingsToggleCardProps = {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  testID?: string;
};

/**
 * The standard settings "enable" control: a card wrapping a label and an on/off
 * Switch. Used to gate a whole feature (Calendar, Habits, Notes, Journal). The
 * Switch's `accessibilityLabel` mirrors the label so tests can query by it.
 */
export function SettingsToggleCard({
  label,
  value,
  onValueChange,
  testID,
}: TSettingsToggleCardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderRadius: theme.borderRadius,
        },
      ]}
    >
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          true: theme.colors.primary,
          false: withOpacity(theme.colors.text, 0.2),
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
  },
});
