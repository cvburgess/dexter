import Ionicons from "@react-native-vector-icons/ionicons";
import { Platform, TouchableOpacity } from "react-native";

import { useTheme } from "@/utils/theme";

type TCloseButtonProps = {
  onPress: () => void;
  testID?: string;
};

/** The Cancel (✕) button for a modal header. */
export function CloseButton({
  onPress,
  testID = "modal-close-button",
}: TCloseButtonProps) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      accessibilityLabel="Cancel"
      accessibilityRole="button"
      style={Platform.OS === "web" ? { marginLeft: 20 } : { marginRight: 4 }}
      testID={testID}
      onPress={onPress}
    >
      <Ionicons color={theme.colors.text} name="close" size={28} />
    </TouchableOpacity>
  );
}

type TDoneButtonProps = {
  disabled?: boolean;
  onPress: () => void;
  testID?: string;
};

/** The Save (✓) button for a modal header, tinted with the primary color. */
export function DoneButton({
  disabled = false,
  onPress,
  testID = "modal-done-button",
}: TDoneButtonProps) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      accessibilityLabel="Save"
      accessibilityRole="button"
      disabled={disabled}
      style={Platform.OS === "web" ? { marginRight: 20 } : { marginLeft: 4 }}
      testID={testID}
      onPress={onPress}
    >
      <Ionicons
        color={disabled ? theme.colors.textSecondary : theme.colors.primary}
        name="checkmark"
        size={28}
      />
    </TouchableOpacity>
  );
}
