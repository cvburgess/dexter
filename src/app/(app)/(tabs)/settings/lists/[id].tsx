import { Href, Redirect, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { TCreateList, TList } from "@/api/lists";
import { Button } from "@/components/Button";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { EmojiPicker } from "@/components/EmojiPicker";
import { ModalLoadingScreen } from "@/components/ModalLoadingScreen";
import { ModalScreen } from "@/components/ModalScreen";
import { TextInput } from "@/components/TextInput";
import { WebModalHeader } from "@/components/WebModalHeader";
import { useConfirmation } from "@/hooks/useConfirmation";
import { useLists } from "@/hooks/useLists";
import { useDismissModal } from "@/hooks/useDismissModal";
import { useModalHeaderActions } from "@/hooks/useModalHeaderActions";
import { showSaveError } from "@/utils/showSaveError";
import { useTheme } from "@/utils/theme";

/** Where this modal returns to when it can't just pop — one value, because a
 * stale link and a ✕ have to land in the same place. */
const HOME: Href = "/settings/lists";

const DEFAULT_EMOJI = "📋";

export default function ListScreen() {
  // "/settings/lists/new" is the create route; any other id edits that list.
  const { id } = useLocalSearchParams<{ id: string }>();
  const [, { getListById, isLoading }] = useLists();

  // Editing is decided by the route, not by whether the list has loaded yet —
  // otherwise a cold cache (deep link / web reload) would treat an edit as a
  // create and save a duplicate.
  const isEditing = id !== "new";
  const existing = getListById(isEditing ? id : null);

  // Still fetching: wait for the list so the form initializes from its saved
  // values.
  if (isEditing && !existing && isLoading)
    return <ModalLoadingScreen fallback={HOME} />;

  // Loaded with no match (stale link / deleted list): the id is invalid — bail
  // back to the list rather than spin forever.
  if (isEditing && !existing) return <Redirect href={HOME} />;

  // The `key` remounts the form if the resolved list changes.
  return <ListForm key={existing?.id ?? "new"} existing={existing} />;
}

function ListForm({ existing }: { existing?: TList }) {
  const theme = useTheme();

  const [, { createList, updateList }] = useLists();
  const { confirm, confirmationProps } = useConfirmation();

  const isEditing = !!existing;

  const [emoji, setEmoji] = useState(existing?.emoji ?? DEFAULT_EMOJI);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const hasSaved = useRef(false);

  const canSave = title.trim().length > 0;

  const handleClose = useDismissModal(HOME);

  const handleSave = () => {
    if (hasSaved.current || !canSave) return;
    hasSaved.current = true;

    const callbacks = {
      onSuccess: handleClose,
      onError: () => {
        hasSaved.current = false;
        showSaveError("list");
      },
    };

    if (isEditing && existing) {
      updateList({ id: existing.id, emoji, title: title.trim() }, callbacks);
    } else {
      const list: TCreateList = { emoji, title: title.trim() };
      createList(list, callbacks);
    }
  };

  const handleArchive = async () => {
    if (!existing) return;
    const confirmed = await confirm({
      title: `Archive ${existing.title}?`,
      message:
        "Archiving hides this list and cancels any of its open tasks. This can't be undone from here.",
      confirmLabel: "Archive",
      destructive: true,
    });
    if (!confirmed) return;
    updateList(
      { id: existing.id, isArchived: true },
      { onSuccess: handleClose, onError: () => showSaveError("list") },
    );
  };

  useModalHeaderActions({
    title: isEditing ? "Edit List" : "New List",
    canSave,
    onClose: handleClose,
    onSave: handleSave,
  });

  const inputBorder = theme.colors.border;

  return (
    <ModalScreen>
      <WebModalHeader
        isDisabled={!canSave}
        onClose={handleClose}
        onSave={handleSave}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          gap: theme.space.sm,
          padding: theme.space.md,
          // After the shorthand, not before it: both resolve to the same
          // bottom inset, but reading it in this order doesn't require
          // knowing that.
          paddingBottom: theme.space.lg,
        }}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: theme.colors.background }}
      >
        <View style={[styles.titleRow, { gap: theme.space.sm }]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Choose emoji"
            onPress={() => setPickerOpen(true)}
            style={[
              styles.emoji,
              {
                borderColor: inputBorder,
                borderRadius: theme.radii.md,
                // A tap target a step above a standard icon button — the emoji
                // is the screen's identity, not one of its controls.
                height: theme.controls.md + theme.space.sm,
                width: theme.controls.md + theme.space.sm,
              },
            ]}
          >
            <Text style={{ fontSize: theme.icons.md + theme.space.xs }}>
              {emoji}
            </Text>
          </TouchableOpacity>
          <TextInput
            accessibilityLabel="List title"
            autoFocus={!isEditing}
            placeholder="What do you want to call this list?"
            returnKeyType="done"
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            onSubmitEditing={handleSave}
          />
        </View>

        {isEditing && (
          <View style={{ gap: theme.space.sm, marginTop: theme.space.sm }}>
            <Button variant="dangerous" onPress={handleArchive}>
              Archive
            </Button>
          </View>
        )}
      </ScrollView>

      <EmojiPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(next) => {
          setEmoji(next);
          setPickerOpen(false);
        }}
      />

      <ConfirmationModal {...confirmationProps} />
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  emoji: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
  },
  titleInput: {
    flex: 1,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
  },
});
