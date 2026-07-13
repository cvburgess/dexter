import Ionicons from "@react-native-vector-icons/ionicons";
import { Platform, TouchableOpacity } from "react-native";

import { useTheme } from "@/utils/theme";

type THeaderAddButtonProps = {
  accessibilityLabel: string;
  onPress: () => void;
  testID?: string;
  visible?: boolean;
};

/**
 * The "+" add button for a settings screen header, tinted with the primary
 * color. Shared by screens that add an item to a feature's list (Habits,
 * Journal). Renders nothing when `visible` is false so a disabled feature never
 * shows its add affordance.
 */
export function HeaderAddButton({
  accessibilityLabel,
  onPress,
  testID,
  visible = true,
}: THeaderAddButtonProps) {
  const theme = useTheme();

  if (!visible) return null;

  return (
    <TouchableOpacity
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={Platform.OS === "web" ? { marginRight: 20 } : undefined}
      testID={testID}
    >
      <Ionicons color={theme.colors.primary} name="add" size={28} />
    </TouchableOpacity>
  );
}
