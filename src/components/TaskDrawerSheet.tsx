import {
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetMethods,
} from "@expo/ui/community/bottom-sheet";
import { Temporal } from "@js-temporal/polyfill";
import type { Ref } from "react";
import { useState } from "react";

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
  // `BottomSheetModal` mounts its children immediately regardless of
  // presentation state — only the sheet's own visibility is deferred until
  // `present()`. Without this gate, TaskDrawer's useTasks/useLists/useGoals
  // queries would fire on every Today-tab load whether or not the user ever
  // opens the drawer. Rendering nothing until the first `onChange` (fired
  // once `present()` moves the sheet to a real snap point) keeps the drawer
  // truly opt-in; it then stays mounted across later opens/closes, same as
  // it always has since this component itself never unmounts.
  const [hasOpened, setHasOpened] = useState(false);

  return (
    <BottomSheetModal
      ref={ref}
      enablePanDownToClose
      onChange={(index) => {
        if (index >= 0) setHasOpened(true);
      }}
    >
      <BottomSheetScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {hasOpened ? <TaskDrawer date={date} /> : null}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
