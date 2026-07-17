import { useNavigation } from "expo-router";
import { useLayoutEffect } from "react";

import { CloseButton, DoneButton } from "@/components/ModalHeaderButtons";
import { useTheme } from "@/utils/theme";

type TModalHeaderActionsOptions = {
  /** Omit to leave the route's own title untouched (new-task has none). */
  title?: string;
  canSave: boolean;
  onClose: () => void;
  onSave: () => void;
};

/** Wires a modal-style header's Cancel/Save actions (native buttons + the
 * `unstable_header*Items` variants), shared by every create/edit form
 * (new-task, and the tasks/habits/lists settings screens). */
export function useModalHeaderActions({
  title,
  canSave,
  onClose,
  onSave,
}: TModalHeaderActionsOptions): void {
  const navigation = useNavigation();
  const theme = useTheme();

  // No dependency array: the handlers close over the latest form state, so
  // the header must be re-wired on every render.
  useLayoutEffect(() => {
    navigation.setOptions({
      ...(title !== undefined && { title }),
      headerLeft: () => <CloseButton onPress={onClose} />,
      headerRight: () => <DoneButton disabled={!canSave} onPress={onSave} />,
      unstable_headerLeftItems: () => [
        {
          type: "button",
          label: "Cancel",
          icon: { type: "sfSymbol", name: "xmark" },
          tintColor: theme.colors.text,
          onPress: onClose,
        },
      ],
      unstable_headerRightItems: () => [
        {
          type: "button",
          label: "Save",
          icon: { type: "sfSymbol", name: "checkmark" },
          variant: "done",
          tintColor: theme.colors.primary,
          disabled: !canSave,
          onPress: onSave,
        },
      ],
    });
  });
}
