import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  Alert,
  Platform,
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
import { LoadingScreen } from "@/components/LoadingScreen";
import { TextInput } from "@/components/TextInput";
import { WebModalHeader } from "@/components/WebModalHeader";
import { useConfirmation } from "@/hooks/useConfirmation";
import { useLists } from "@/hooks/useLists";
import { useModalHeaderActions } from "@/hooks/useModalHeaderActions";
import { useTheme, withOpacity } from "@/utils/theme";

const DEFAULT_EMOJI = "📋";

// RN's Alert is a no-op on web, so fall back to the browser's alert there.
const showSaveError = () => {
  const message = "We couldn't save your list. Please try again.";

  if (Platform.OS === "web") {
    window.alert(message);
  } else {
    Alert.alert("Something went wrong", message);
  }
};

export default function ListScreen() {
  // "/settings/lists/new" is the create route; any other id edits that list.
  const { id } = useLocalSearchParams<{ id: string }>();
  const [, { getListById, isLoading }] = useLists();

  // Editing is decided by the route, not by whether the list has loaded yet —
  // otherwise a cold cache (deep link / web reload) would treat an edit as a
  // create and save a duplicate.
  const isEditing = id !== "new";
  const existing = getListById(isEditing ? id : null);

  if (isEditing && !existing) {
    // Still fetching: wait for the list so the form initializes from its saved
    // values. Once loaded with no match (stale link / deleted list), the id is
    // invalid — bail back to the list rather than spin forever.
    return isLoading ? <LoadingScreen /> : <Redirect href="/settings/lists" />;
  }

  // The `key` remounts the form if the resolved list changes.
  return <ListForm key={existing?.id ?? "new"} existing={existing} />;
}

function ListForm({ existing }: { existing?: TList }) {
  const theme = useTheme();
  const router = useRouter();

  const [, { createList, updateList }] = useLists();
  const { confirm, confirmationProps } = useConfirmation();

  const isEditing = !!existing;

  const [emoji, setEmoji] = useState(existing?.emoji ?? DEFAULT_EMOJI);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const hasSaved = useRef(false);

  const canSave = title.trim().length > 0;

  const handleClose = () => router.back();

  const handleSave = () => {
    if (hasSaved.current || !canSave) return;
    hasSaved.current = true;

    const callbacks = {
      onSuccess: () => router.back(),
      onError: () => {
        hasSaved.current = false;
        showSaveError();
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
      { onSuccess: () => router.back(), onError: showSaveError },
    );
  };

  useModalHeaderActions({
    title: isEditing ? "Edit List" : "New List",
    canSave,
    onClose: handleClose,
    onSave: handleSave,
  });

  const inputBorder = withOpacity(theme.colors.text, 0.1);

  return (
    <>
      <WebModalHeader
        isDisabled={!canSave}
        onClose={handleClose}
        onSave={handleSave}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.container,
          { gap: theme.gap, padding: theme.spacing },
        ]}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: theme.colors.background }}
      >
        <View style={styles.titleRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Choose emoji"
            onPress={() => setPickerOpen(true)}
            style={[
              styles.emoji,
              { borderColor: inputBorder, borderRadius: theme.borderRadius },
            ]}
          >
            <Text style={styles.emojiGlyph}>{emoji}</Text>
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
          <View style={styles.dangerZone}>
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 32,
  },
  dangerZone: {
    gap: 12,
    marginTop: 12,
  },
  emoji: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    height: 50,
    justifyContent: "center",
    width: 50,
  },
  emojiGlyph: {
    fontSize: 24,
  },
  titleInput: {
    flex: 1,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
});
