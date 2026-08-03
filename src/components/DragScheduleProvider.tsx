import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import { DraxProvider } from "react-native-drax";

import { TTask } from "@/api/tasks";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { useScheduleChange } from "@/hooks/useScheduleChange";
import { useTasks } from "@/hooks/useTasks";

export type TDragSchedule = {
  /**
   * The task a drag payload refers to, as it is *right now* rather than as it
   * was when the card registered with drax. See `isTaskDragPayload` for why the
   * payload can't just carry the task. Returns `undefined` if the task has been
   * deleted mid-drag.
   */
  getTask: (taskId: string) => TTask | undefined;
  /** Moves a task to `scheduledFor` (`null` unschedules), prompting first if it carries an alarm. */
  scheduleTask: (task: TTask, scheduledFor: string | null) => Promise<void>;
};

const DragScheduleContext = createContext<TDragSchedule | null>(null);

/**
 * Whether drag-to-schedule is available here, and how to commit a drop.
 *
 * `null` outside a provider, and that default is the whole point rather than an
 * afterthought: `react-native-drax`'s `useDraxContext()` throws outright if a
 * `DraxView` mounts without a `DraxProvider` above it. `DayTaskList`,
 * `TaskDrawer`, and `TaskCard` are all shared with the small-screen layouts,
 * where no provider exists. Gating on context makes "never mount a DraxView
 * without a provider" true by construction, instead of true as long as every
 * caller remembers to pass an `enableDrag` prop.
 */
export function useDragSchedule(): TDragSchedule | null {
  return useContext(DragScheduleContext);
}

type TDragScheduleProviderProps = {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * Hosts drag-to-schedule for one large-screen layout (DEX-77): the drax
 * provider every draggable card and drop target registers with, the single
 * task subscription their drops write through, and the one confirmation modal
 * that asks about alarms.
 *
 * Scoped per layout rather than mounted at the app root. `DraxProvider` renders
 * a real view and measures the hover layer's coordinate space from it, so each
 * of `WeekView` and `LargeScreenToday` wants its own — and the small-screen
 * layouts, which can't support a drag at all, then mount nothing.
 *
 * Owning `useTasks()` here rather than in each drop target is what keeps a week
 * of seven columns from opening seven subscriptions and mounting seven modals.
 */
export function DragScheduleProvider({
  style,
  children,
}: TDragScheduleProviderProps) {
  const [tasks, { updateTask }] = useTasks();
  const { changeSchedule, confirmationProps } = useScheduleChange(updateTask);

  // Read through a ref so `getTask` can stay identity-stable while still seeing
  // the current cache. Both matter: the drop targets hand their handlers to
  // drax's registry, which never refreshes them (see `TaskDropTarget`), so a
  // handler that closed over a `tasks` array would answer from whenever it was
  // built. This provider re-renders on every write to `["tasks"]`, so the ref
  // is never more than a render behind. Written from an effect rather than
  // during render (`react-hooks/refs`); both are only ever read from a drag,
  // long after the commit that refreshed them.
  //
  // `changeSchedule` goes through a ref for a second reason: it is *not* stable.
  // It memoizes on the updater it is given, and `useTasks`' `updateTask` is a
  // bare arrow rebuilt every render — so a context value derived from it would
  // change identity on every write to `["tasks"]`, i.e. on every checkbox tap
  // anywhere on screen, and re-render all eight drop targets on the Week tab.
  const tasksRef = useRef(tasks);
  const changeScheduleRef = useRef(changeSchedule);
  useEffect(() => {
    tasksRef.current = tasks;
    changeScheduleRef.current = changeSchedule;
  });

  // Built once, deliberately: every field reads through a ref, so there is
  // nothing for a dependency to track. This is what lets consumers skip the
  // re-render — `children` is an element the parent built, so React already
  // bails out of the subtree, but a changed context value would reach past that
  // bailout into every consumer inside it.
  const value = useMemo(
    () => ({
      getTask: (taskId: string) =>
        tasksRef.current.find((task) => task.id === taskId),
      scheduleTask: (task: TTask, scheduledFor: string | null) =>
        changeScheduleRef.current(task, scheduledFor),
    }),
    [],
  );

  return (
    <>
      {/* `DraxProvider` renders `<View style={style}>{children}<HoverLayer/></View>`.
          It takes the flex box and the caller's own row/column stays inside it,
          so adding drag doesn't reshape a layout that was already correct. */}
      <DraxProvider style={[styles.dragArea, style]}>
        <DragScheduleContext.Provider value={value}>
          {children}
        </DragScheduleContext.Provider>
      </DraxProvider>
      {/* A sibling of the drag area rather than a child of it, so the prompt
          can't inherit a transform or an overflow clip from the pane a card was
          dropped on. */}
      <ConfirmationModal {...confirmationProps} />
    </>
  );
}

const styles = StyleSheet.create({
  dragArea: {
    flex: 1,
  },
});
