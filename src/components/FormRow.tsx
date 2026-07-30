import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/utils/theme";

type TFormRowProps = {
  label: string;
  children: ReactNode;
  /** Row's minimum height, for forms that need a tighter row. Defaults to `theme.controls.md`. */
  minHeight?: number;
};

/** A label + right-aligned control row, shared by the app's settings/create forms. */
export function FormRow({ label, children, minHeight }: TFormRowProps) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { minHeight: minHeight ?? theme.controls.md }]}>
      <Text style={{ ...theme.fonts.title, color: theme.colors.text }}>
        {label}
      </Text>
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
});
