import { ReactNode } from "react";
import { StyleSheet, Text } from "react-native";

import { useTheme } from "@/utils/theme";

type TSettingsSectionTitleProps = {
  children: ReactNode;
  testID?: string;
};

/**
 * Uppercase secondary label heading a group of settings. Adds top margin so
 * consecutive sections read as clearly separated blocks.
 */
export function SettingsSectionTitle({
  children,
  testID,
}: TSettingsSectionTitleProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        styles.title,
        { color: theme.colors.textSecondary, marginTop: theme.spacing },
      ]}
      testID={testID}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
  },
});
