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

/**
 * The scrolling behavior both task modals give their form. Shared so the
 * keyboard insets, the labelled-row spacing, and the add-a-subtask autoscroll
 * can't drift between create and edit, which are meant to feel identical.
 *
 * A hook rather than a wrapper component: the screens need to put their own
 * content (new-task's mode control and template picker) inside the same
 * scroller, and handing the autoscroll signal back through a render prop trips
 * `react-hooks/refs` — it can't tell that `children` won't invoke the callback
 * during the render pass it was handed in.
 */
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
      // Insets the content by the keyboard's height (iOS) so the fields it
      // covers stay reachable. Android resizes the window instead (Expo's
      // default softwareKeyboardLayoutMode), and web has no overlay keyboard.
      automaticallyAdjustKeyboardInsets: true,
      // `md`, not `sm`: the rows are labelled sections rather than controls in a
      // group, and want more air between them than the in-group gap gives. The
      // heavier bottom padding clears the sheet's edge, so the last field isn't
      // flush against it.
      contentContainerStyle: {
        gap: theme.space.md,
        padding: theme.space.md,
        paddingBottom: theme.space.lg,
      },
      keyboardShouldPersistTaps: "handled",
      // A subtask row is added and autofocused in one go, so it has to be on
      // screen before the user types. Subtasks are the last field, making the
      // end of the content the right target; keying off the content size
      // (rather than scrolling from the tap) waits for the new row to lay out,
      // so the scroll can't run against a stale height.
      onContentSizeChange: () => {
        if (!pendingScroll.current) return;
        pendingScroll.current = false;
        scrollRef.current?.scrollToEnd({ animated: true });
      },
      style: { backgroundColor: theme.colors.background },
    },
  };
}
