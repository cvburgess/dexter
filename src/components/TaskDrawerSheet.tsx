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

// present(filter, search) pre-applies a Filter preset and seeds search before
// opening — Today's attention filter (DEX-58) or Search's query (DEX-47).
export type TTaskDrawerSheetHandle = {
  present: (filter?: TFilterId, search?: string) => void;
};

type TTaskDrawerSheetProps = {
  date: Temporal.PlainDate;
  ref?: Ref<TTaskDrawerSheetHandle>;
};

// Fixed detents — without them the sheet fits-to-content and leaves
// TaskDrawer's scroll content unbounded. Module-level for a stable identity.
const SNAP_POINTS = ["55%", "90%"];

// Mobile shell (DEX-33) for TaskDrawer in @expo/ui's BottomSheetModal; opened
// imperatively via ref.current?.present() since there's no controlled prop.
export function TaskDrawerSheet({ date, ref }: TTaskDrawerSheetProps) {
  const theme = useTheme();
  // Children mount immediately; only visibility defers. Queries are already
  // warmed (DEX-57), so this saves rendering the FlashList, not a fetch.
  const [hasOpened, setHasOpened] = useState(false);
  // Owned here so present() can seed both before the sheet opens.
  const [filterId, setFilterId] = useState<TFilterId>("none");
  const [search, setSearch] = useState("");
  const sheetRef = useRef<BottomSheetMethods>(null);
  const insets = useSafeAreaInsets();
  // Today's inset bakes in the tab bar height, but this sheet presents over
  // the bar and draws its own chrome — zero it for the subtree.
  const contentInsets = useMemo(() => ({ ...insets, bottom: 0 }), [insets]);

  // Deps []: closes only over stable refs/setters, built once.
  useImperativeHandle(
    ref,
    () => ({
      present: (filter, seedSearch) => {
        // Set both first so the deferred TaskDrawer mounts already seeded;
        // omitting either leaves whatever the user last had.
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
      {/* flex:1 bounds TaskDrawer's FlashList within the detent; the sheet
          host paints no background of its own, so this supplies one. */}
      <BottomSheetView
        style={[styles.content, { backgroundColor: theme.colors.background }]}
      >
        {/* Zeroes the inherited bottom inset for the subtree. */}
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
