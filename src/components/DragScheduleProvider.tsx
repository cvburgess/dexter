import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { StyleSheet } from "react-native";
import { DraxProvider } from "react-native-drax";

import { TTask } from "@/api/tasks";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { useScheduleChange } from "@/hooks/useScheduleChange";
import { useTasks } from "@/hooks/useTasks";

export type TDragSchedule = {
  /** The task a payload refers to *right now*, not at drax registration time
   * (see `isTaskDragPayload`); `undefined` if deleted mid-drag. */
  getTask: (taskId: string) => TTask | undefined;
  /** Moves a task to `scheduledFor` (`null` unschedules), prompting first if it carries an alarm. */
  scheduleTask: (task: TTask, scheduledFor: string | null) => Promise<void>;
};

const DragScheduleContext = createContext<TDragSchedule | null>(null);

/** `null` outside a provider by design — `useDraxContext()` throws if a
 * `DraxView` mounts without one, so context enforces it structurally. */
export function useDragSchedule(): TDragSchedule | null {
  return useContext(DragScheduleContext);
}

type TDragScheduleProviderProps = {
  children: ReactNode;
};

/** Hosts drag-to-schedule per large-screen layout, not the app root (DEX-77) —
 * `DraxProvider` needs a real view per layout; one `useTasks()` avoids seven subscriptions on Week. */
export function DragScheduleProvider({ children }: TDragScheduleProviderProps) {
  const [tasks, { updateTask }] = useTasks();
  const { changeSchedule, confirmationProps } = useScheduleChange(updateTask);

  // Refs keep both identity-stable — drax's registry never refreshes handed-off
  // handlers, and `changeSchedule` itself is unstable (rebuilt every render).
  const tasksRef = useRef(tasks);
  const changeScheduleRef = useRef(changeSchedule);
  useEffect(() => {
    tasksRef.current = tasks;
    changeScheduleRef.current = changeSchedule;
  });

  // Built once — every field reads through a ref, so a changed context value
  // would otherwise bypass React's bailout on unchanged `children`.
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
      {/* DraxProvider renders View>{children}<HoverLayer/>; the caller's own
          row/column stays inside it, so adding drag doesn't reshape layout. */}
      <DraxProvider style={styles.dragArea}>
        <DragScheduleContext.Provider value={value}>
          {children}
        </DragScheduleContext.Provider>
      </DraxProvider>
      {/* A sibling, not a child, of the drag area — no inherited transform or
          clip from the pane a card was dropped on. */}
      <ConfirmationModal {...confirmationProps} />
    </>
  );
}

const styles = StyleSheet.create({
  dragArea: {
    flex: 1,
  },
});
