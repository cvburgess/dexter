import {
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetMethods,
} from "@expo/ui/community/bottom-sheet";
import { Temporal } from "@js-temporal/polyfill";
import type { Ref } from "react";

import { TaskDrawer } from "@/components/TaskDrawer";

type TTaskDrawerSheetProps = {
  date: Temporal.PlainDate;
  ref?: Ref<BottomSheetMethods>;
};

/**
 * Mobile shell for the task drawer (DEX-33): hosts the shared `TaskDrawer`
 * content in a native bottom sheet (SwiftUI sheet on iOS, Compose
 * `ModalBottomSheet` on Android, a vaul drawer on web) via `@expo/ui`'s
 * `@gorhom/bottom-sheet`-compatible drop-in. Starts closed; the caller opens
 * it imperatively with `ref.current?.present()` from a header button, since
 * `BottomSheetModal` has no controlled "visible" prop.
 */
export function TaskDrawerSheet({ date, ref }: TTaskDrawerSheetProps) {
  return (
    <BottomSheetModal ref={ref} enablePanDownToClose>
      <BottomSheetScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <TaskDrawer date={date} />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
