import {
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetMethods,
} from "@expo/ui/community/bottom-sheet";
import { Temporal } from "@js-temporal/polyfill";
import type { Ref } from "react";
import { useImperativeHandle, useMemo, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import {
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { TaskDrawer } from "@/components/TaskDrawer";
import { TFilterId } from "@/utils/taskFilters";
import { useTheme } from "@/utils/theme";

/**
 * Imperative handle for the mobile drawer sheet. `present(filter, search)`
 * optionally pre-applies a Filter preset and seeds the search box before
 * opening — the Today screen passes the attention filter (Overdue/Left Behind)
 * so tapping "Backlog" lands on the relevant view (DEX-58), and passes
 * `unscheduled` plus the query when a Search-tab result for an unscheduled task
 * opens the backlog (DEX-47). Called with no arguments, it just opens the sheet
 * and leaves both as they were.
 */
export type TTaskDrawerSheetHandle = {
  present: (filter?: TFilterId, search?: string) => void;
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
  const theme = useTheme();
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
  // Owned here for the same reason as `filterId`: `present()` has to be able to
  // seed it before the sheet (and the deferred TaskDrawer below) opens.
  const [search, setSearch] = useState("");
  const sheetRef = useRef<BottomSheetMethods>(null);
  const insets = useSafeAreaInsets();
  // The Today tab's screens sit under the native tab bar, so the inset they
  // publish has the bar's height baked into `bottom`. This sheet is presented
  // *over* that bar and draws its own bottom chrome, so for anything inside it
  // that figure is simply wrong — zero it for the subtree (below) rather than
  // having each child (TaskDrawer's list, the EmptyScreen it falls back to)
  // correct for a host it can't see. Memoized so a filter change here doesn't
  // hand the subtree a fresh context value and re-render every consumer of it.
  const contentInsets = useMemo(() => ({ ...insets, bottom: 0 }), [insets]);

  // Deps `[]`: the handle only closes over the stable `sheetRef` and the stable
  // `setFilterId`/`setSearch` setters, so it's built once rather than on every
  // render.
  useImperativeHandle(
    ref,
    () => ({
      present: (filter, seedSearch) => {
        // Set both first so the deferred TaskDrawer mounts already filtered and
        // searched; omitting either leaves whatever the user last had.
        if (filter) setFilterId(filter);
        if (seedSearch !== undefined) setSearch(seedSearch);
        sheetRef.current?.present();
      },
    }),
    [],
  );

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
      {/* The sheet host paints no surface of its own, so without this the
          backlog sat on whatever was behind it and its cards and text read
          against the Today screen. The settings editors' background, so a modal
          is a modal wherever it is presented from. */}
      <BottomSheetView
        style={[styles.content, { backgroundColor: theme.colors.background }]}
      >
        {/* `contentInsets` above zeroes the inherited bottom inset. Content is
            still a plain React child of this tree, so the override reaches it
            the same way `useTheme` already does. */}
        <SafeAreaInsetsContext.Provider value={contentInsets}>
          {hasOpened ? (
            <TaskDrawer
              date={date}
              filterId={filterId}
              onFilterChange={setFilterId}
              search={search}
              onSearchChange={setSearch}
            />
          ) : null}
        </SafeAreaInsetsContext.Provider>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
