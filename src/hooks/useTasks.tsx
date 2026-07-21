import { Temporal } from "@js-temporal/polyfill";
import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { makeOrFilter, TQueryFilter } from "@/api/applyFilters";
import {
  createTask,
  deleteTask,
  ETaskStatus,
  getTasks,
  TCreateTask,
  TTask,
  TUpdateTask,
  updateTask,
  updateTasks,
} from "@/api/tasks";
import { getTemplates, TTemplate } from "@/api/templates";
import { getNextTaskDate } from "@/utils/repeatSchedule";
import { subtasksFromTemplate, sweepSubtasks } from "@/utils/subtasks";
import { isCompletionStatus } from "@/utils/taskFilters";

import { supabase } from "./useAuth";

type TMutateCallbacks = {
  onError?: (error: Error) => void;
  onSuccess?: () => void;
};

type TUseTasks = [
  TTask[],
  {
    createTask: (task: TCreateTask, callbacks?: TMutateCallbacks) => void;
    deleteTask: (id: string) => void;
    isLoading: boolean;
    updateTask: (task: TUpdateTask) => void;
    updateTasks: (tasks: TUpdateTask[]) => void;
  },
];

type TSupabaseHookOptions = {
  skipQuery?: boolean;
};

// How far back the canonical fetch reaches for completed tasks — wide enough
// that the Today list's recently-checked-off rows stay visible, bounded so
// the payload doesn't grow with the account's full task history. Incomplete
// tasks are never excluded by this window (DEX-57).
const RECENT_TASK_WINDOW_DAYS = 30;

const getToday = () => Temporal.Now.plainDateISO();

/** Finds a task in the canonical `["tasks"]` cache entry. */
const findCachedTask = (
  queryClient: QueryClient,
  id: string,
): TTask | undefined =>
  queryClient.getQueryData<TTask[]>(["tasks"])?.find((task) => task.id === id);

/**
 * Folds a subtask sweep into a completing update, so checking off a parent
 * closes its whole checklist in the *same* row write. Doing it here rather than
 * at each call site is what makes the sweep atomic — and means no future caller
 * can complete a task and silently leave its children open.
 *
 * Deliberately does nothing when the caller already supplied `subtasks` (an
 * explicit array wins over the sweep), when the task isn't in the cache, or when
 * every subtask already carries the target status.
 */
const withSubtaskSweep = (
  queryClient: QueryClient,
  diff: TUpdateTask,
): TUpdateTask => {
  const { status } = diff;
  if (!isCompletionStatus(status) || diff.subtasks) return diff;

  const task = findCachedTask(queryClient, diff.id);
  if (!task?.subtasks.length) return diff;

  const subtasks = sweepSubtasks(task.subtasks, status);
  const unchanged = subtasks.every(
    (subtask, index) => subtask === task.subtasks[index],
  );

  return unchanged ? diff : { ...diff, subtasks };
};

/**
 * When an update completes a repeat task, schedule its next occurrence — the
 * TypeScript replacement for the dropped `create_next_recurring_task` trigger
 * (DEX-21). Runs on the update's success, before the cache is invalidated, so
 * the pre-update task (its previous status, template link, and scheduled date)
 * is still readable. No-ops unless this update is a fresh transition into
 * done/won't-do on a task linked to a template with a schedule.
 */
const maybeCreateNextRecurringTask = async (
  queryClient: QueryClient,
  diff: TUpdateTask,
): Promise<void> => {
  if (!isCompletionStatus(diff.status)) return;

  const task = findCachedTask(queryClient, diff.id);
  // Already-complete tasks don't re-spawn (mirrors the trigger's OLD.status
  // guard); a task missing from the cache is skipped rather than guessed at.
  if (!task || !task.templateId || isCompletionStatus(task.status)) return;

  const templates =
    queryClient.getQueryData<TTemplate[]>(["templates"]) ??
    (await queryClient.fetchQuery<TTemplate[]>({
      queryKey: ["templates"],
      queryFn: () => getTemplates(supabase),
    }));
  const template = templates.find(({ id }) => id === task.templateId);
  if (!template?.schedule) return;

  const nextDate = getNextTaskDate(
    { scheduledFor: task.scheduledFor },
    template.schedule,
    getToday().toString(),
  );
  if (!nextDate) return;

  await createTask(supabase, {
    title: template.title,
    alarmTime: template.alarmTime,
    priority: template.priority,
    listId: template.listId,
    goalId: template.goalId,
    scheduledFor: nextDate,
    templateId: template.id,
    status: ETaskStatus.TODO,
    // Each occurrence gets its own copy of the checklist, reset to open. Array
    // items carry no template link, so there is no orphan-spawn hazard here.
    subtasks: subtasksFromTemplate(template.subtasks, ETaskStatus.TODO),
  });
};

/**
 * The single fetch the Today and Backlog views derive from: every incomplete
 * task, plus any task (regardless of status) scheduled within the last
 * `RECENT_TASK_WINDOW_DAYS` days — bounding the payload while keeping the
 * Today list's recently-completed rows intact. Filtering, grouping, and
 * searching for a specific view all happen client-side over this one cached
 * array (see `utils/taskFilters.ts`) instead of separate server queries per
 * view/day/filter (DEX-57). Not a general-purpose "all tasks" fetch — a view
 * needing full history or a different window (e.g. an analytics screen)
 * would need its own query, since old completed/won't-do tasks fall outside
 * this window entirely.
 */
export const canonicalTaskFilters = (): TQueryFilter[] => [
  makeOrFilter([
    ["status", "in", [ETaskStatus.TODO, ETaskStatus.IN_PROGRESS]],
    [
      "scheduledFor",
      "gte",
      getToday().subtract({ days: RECENT_TASK_WINDOW_DAYS }).toString(),
    ],
  ]),
];

export const useTasks = (options?: TSupabaseHookOptions): TUseTasks => {
  const queryClient = useQueryClient();

  const { data: tasks = [], isPlaceholderData } = useQuery({
    enabled: !options?.skipQuery,
    placeholderData: [],
    queryKey: ["tasks"],
    queryFn: () => getTasks(supabase, canonicalTaskFilters()),
  });

  const { mutate: create } = useMutation<TTask[], Error, TCreateTask>({
    mutationFn: (task) => createTask(supabase, task),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const { mutate: update } = useMutation<TTask[], Error, TUpdateTask>({
    mutationFn: (diff) =>
      updateTask(supabase, withSubtaskSweep(queryClient, diff)),
    onSuccess: (_data, diff) => maybeCreateNextRecurringTask(queryClient, diff),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const { mutate: bulkUpdate } = useMutation<TTask[], Error, TUpdateTask[]>({
    mutationFn: (diffs) =>
      updateTasks(
        supabase,
        diffs.map((diff) => withSubtaskSweep(queryClient, diff)),
      ),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const { mutate: remove } = useMutation<void, Error, string>({
    mutationFn: (id) => deleteTask(supabase, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  return [
    tasks,
    {
      createTask: create,
      deleteTask: remove,
      isLoading: isPlaceholderData,
      updateTask: update,
      updateTasks: bulkUpdate,
    },
  ];
};
