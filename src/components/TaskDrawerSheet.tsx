import {
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetMethods,
} from "@expo/ui/community/bottom-sheet";
import { Temporal } from "@js-temporal/polyfill";
import type { Ref } from "react";
import { useImperativeHandle, useRef, useState } from "react";
import { StyleSheet } from "react-native";

import { TaskDrawer } from "@/components/TaskDrawer";
import { TFilterId } from "@/utils/taskFilters";

/**
 * Imperative handle for the mobile drawer sheet. `present(filter)` optionally
 * pre-applies a Filter preset before opening — the Today screen passes the
 * attention filter (Overdue/Left Behind) so tapping "Backlog" lands on the
 * relevant view (DEX-58). Called with no argument, it just opens the sheet and
 * leaves the current filter as-is.
 */
export type TTaskDrawerSheetHandle = {
  present: (filter?: TFilterId) => void;
};

type TTaskDrawerSheetProps = {
  date: Temporal.PlainDate;
  ref?: Ref<TTaskDrawerSheetHandle>;
};

// Fixed detents (opens at the first, 55%; drag up to 90%). Without explicit
// snap points the sheet falls into `enableDynamicSizing`/fit-to-content mode,
// which sizes to the content's full height and leaves TaskDrawer's scrollable
// content unbounded. Module-level for a stable array identity across renders
// (the library memoizes its derived detents on this prop). On Android these
// map to partial (~55%) + expanded; on web both heights apply via CSS.
const SNAP_POINTS = ["55%", "90%"];

/**
 * Mobile shell for the task drawer (DEX-33): hosts the shared `TaskDrawer` in
 * `@expo/ui/community/bottom-sheet`'s `BottomSheetModal` — a native SwiftUI
 * sheet on iOS, a Compose `ModalBottomSheet` on Android, and a vaul drawer on
 * web. `BottomSheetView` (a plain flex passthrough) fills the detent, and
 * `TaskDrawer` owns its scrollable content (a `FlashList`) inside it. Starts
 * closed; the
 * caller opens it imperatively with `ref.current?.present()` from the
 * `DayViewSwitcher` menu's drawer action (`BottomSheetModal` has no controlled
 * "visible" prop).
 */
export function TaskDrawerSheet({ date, ref }: TTaskDrawerSheetProps) {
  // `BottomSheetModal` mounts its children immediately regardless of
  // presentation state — only the sheet's own visibility is deferred until
  // `present()`. TaskDrawer's `useTasks()` is the same canonical query the
  // always-visible Tasks pane already fires (DEX-57), and `useLists`/`useGoals`
  // are warmed as soon as a session exists (see `(app)/_layout.tsx`), so this
  // gate no longer saves a fetch; it still saves the cost of building and
  // rendering the drawer's `FlashList` content on every Today-tab load whether
  // or not the user ever opens the drawer. Rendering nothing until the first
  // `onChange` (fired once `present()` moves the sheet to a real snap point)
  // keeps that opt-in; it then stays mounted across later opens/closes.
  const [hasOpened, setHasOpened] = useState(false);
  // The drawer's Filter preset is owned here (not inside TaskDrawer) so
  // `present(filter)` can set it before the sheet opens; TaskDrawer runs
  // controlled off this state.
  const [filterId, setFilterId] = useState<TFilterId>("none");
  const sheetRef = useRef<BottomSheetMethods>(null);

  useImperativeHandle(ref, () => ({
    present: (filter) => {
      // Set the filter first so the deferred TaskDrawer mounts already filtered;
      // omitting `filter` leaves whatever the user last had selected.
      if (filter) setFilterId(filter);
      sheetRef.current?.present();
    },
  }));

  return (
    <BottomSheetModal
      ref={sheetRef}
      enablePanDownToClose
      snapPoints={SNAP_POINTS}
      onChange={(index) => {
        if (index >= 0) setHasOpened(true);
      }}
    >
      {/* `flex: 1` gives TaskDrawer a bounded box to fill so its FlashList
          scrolls within the detent (with snap points set, the sheet isn't in
          fit-to-content mode, so BottomSheetView keeps `flex`). */}
      <BottomSheetView style={styles.content}>
        {hasOpened ? (
          <TaskDrawer
            date={date}
            filterId={filterId}
            onFilterChange={setFilterId}
          />
        ) : null}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
