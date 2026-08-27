import { useCallback, useRef } from "react";
import { ScrollView } from "react-native";

import { useTheme } from "@/utils/theme";

type TTaskFormScroll = {
  /** Spread onto the `ScrollView` that wraps a `TaskForm`. */
  scrollViewProps: React.ComponentProps<typeof ScrollView> & {
    ref: React.RefObject<ScrollView | null>;
  };
  /** Hand to `TaskForm`'s `onAddSubtaskRow`. */
  scrollToEndOnNextLayout: () => void;
};

/** Scrolling behavior shared by both task modals so they can't drift. A hook,
 * not a wrapper — a render prop back to screen content trips react-hooks/refs. */
export function useTaskFormScroll(): TTaskFormScroll {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  // Set when a subtask row is added, consumed by the next content size change.
  const pendingScroll = useRef(false);

  const scrollToEndOnNextLayout = useCallback(() => {
    pendingScroll.current = true;
  }, []);

  return {
    scrollToEndOnNextLayout,
    scrollViewProps: {
      ref: scrollRef,
      // Keeps the content below the native header, which floats over the form
      // sheet on iOS.
      contentInsetAdjustmentBehavior: "automatic",
      // iOS insets content by keyboard height; Android resizes the window
      // instead (Expo's default), and web has no overlay keyboard.
      automaticallyAdjustKeyboardInsets: true,
      // `md`, not `sm` — these are labelled sections, not controls in a group,
      // and need more air than the in-group gap gives.
      contentContainerStyle: {
        gap: theme.space.md,
        padding: theme.space.md,
        paddingBottom: theme.space.lg,
      },
      keyboardShouldPersistTaps: "handled",
      // A new subtask is autofocused immediately, so it must be on screen —
      // keying off content size (not the tap) waits for it to lay out first.
      onContentSizeChange: () => {
        if (!pendingScroll.current) return;
        pendingScroll.current = false;
        scrollRef.current?.scrollToEnd({ animated: true });
      },
      style: { backgroundColor: theme.colors.background },
    },
  };
}
