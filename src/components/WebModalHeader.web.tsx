import { StyleSheet, View } from "react-native";

import { CloseButton, DoneButton } from "@/components/ModalHeaderButtons";
import { useTheme } from "@/utils/theme";

import type { TWebModalHeaderProps } from "./WebModalHeader";

/**
 * Web implementation: a header bar with Cancel (✕) and Save (✓) buttons.
 * The Stack header is hidden on web (`utils/stackOptions.web.ts`), so modal
 * screens render this instead.
 */
export function WebModalHeader({
  isDisabled = false,
  onClose,
  onSave,
}: TWebModalHeaderProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.card,
          borderBottomColor: theme.colors.textSecondary,
          paddingVertical: theme.spacing,
        },
      ]}
    >
      <CloseButton onPress={onClose} />
      <DoneButton disabled={isDisabled} onPress={onSave} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
});
