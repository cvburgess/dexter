import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
} from "react-native";

import { useTheme } from "@/utils/theme";

export type ButtonVariant = "primary" | "dangerous" | "default";

interface ButtonProps extends TouchableOpacityProps {
  variant?: ButtonVariant;
  isLoading?: boolean;
  children: string;
}

export function Button({
  variant = "default",
  isLoading = false,
  children,
  style,
  disabled,
  ...props
}: ButtonProps) {
  const theme = useTheme();

  const getBackgroundColor = () => {
    switch (variant) {
      case "primary":
        return theme.colors.primary;
      case "dangerous":
        return theme.colors.card;
      case "default":
        return theme.colors.card;
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case "primary":
        return theme.colors.primaryContent;
      case "dangerous":
        return theme.colors.error;
      case "default":
        return theme.colors.text;
    }
  };

  return (
    <TouchableOpacity
      style={[
        {
          padding: theme.spacing,
          borderRadius: theme.borderRadius,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 50,
          backgroundColor: getBackgroundColor(),
        },
        (disabled || isLoading) && styles.disabled,
        style,
      ]}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <Text style={[styles.text, { color: getTextColor() }]}>{children}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
  },
});
