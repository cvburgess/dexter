import {
  TextInput as NativeTextInput,
  StyleSheet,
  TextInputProps,
} from "react-native";

import { useTheme } from "@/utils/theme";

export function TextInput({ style, ...props }: TextInputProps) {
  const theme = useTheme();

  return (
    <NativeTextInput
      placeholderTextColor={theme.colors.textSecondary}
      style={[
        styles.input,
        {
          color: theme.colors.text,
          backgroundColor: theme.colors.card,
          borderRadius: theme.borderRadius,
          padding: theme.spacing,
        },
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    fontSize: 16,
    width: "100%",
  },
});
