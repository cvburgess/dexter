import type { ReactNode } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useTheme } from "@/utils/theme";

type TPickerSheetProps = {
  visible: boolean;
  /** Heading for the sheet, reused as the confirm button's label. */
  title: string;
  /** Label for the field row, e.g. "Time" or "Date". */
  label: string;
  /** The picker itself — `TimeField`, `DateField`, whatever comes next. */
  children: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * The shell every "pick one value" sheet shares: a dimmed overlay that
 * dismisses on tap, one labelled field row, and Cancel / confirm buttons.
 *
 * It exists because native menus can't host a live picker — `IconMenu` items
 * have to *open* something — so both `SetAlarmModal` and `SetDateModal` put
 * their field in a sheet like this. Layout only: the value, its seeding, and
 * what confirming does all stay with the caller.
 */
export function PickerSheet({
  visible,
  title,
  label,
  children,
  onCancel,
  onConfirm,
}: TPickerSheetProps) {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        {/* Swallows taps on the card so they don't dismiss the sheet. */}
        <Pressable
          style={[
            styles.container,
            {
              backgroundColor: theme.colors.card,
              borderRadius: theme.borderRadius,
              gap: theme.spacing,
            },
          ]}
          onPress={() => {}}
        >
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {title}
          </Text>

          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              {label}
            </Text>
            {children}
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.button, { marginRight: theme.spacing }]}
              onPress={onCancel}
            >
              <Text
                style={[
                  styles.buttonText,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={onConfirm}>
              <Text
                style={[
                  styles.buttonText,
                  styles.confirmText,
                  { color: theme.colors.primary },
                ]}
              >
                {title}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  container: {
    width: "100%",
    maxWidth: 400,
    padding: 20,
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.25)",
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 40,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  buttonText: {
    fontSize: 16,
  },
  confirmText: {
    fontWeight: "600",
  },
});
