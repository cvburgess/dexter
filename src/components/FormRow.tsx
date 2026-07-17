import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/utils/theme";

type TFormRowProps = {
  label: string;
  children: ReactNode;
  /** Row's minimum height, for forms that need a tighter row. Defaults to 40. */
  minHeight?: number;
};

/** A label + right-aligned control row, shared by the app's settings/create forms. */
export function FormRow({ label, children, minHeight = 40 }: TFormRowProps) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { minHeight }]}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
});
