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

/** Finds a task in a snapshot taken before an optimistic write. */
const findTask = (tasks: TTask[] | undefined, id: string): TTask | undefined =>
  tasks?.find((task) => task.id === id);

/**
 * Applies an update diff to a cached task. Only keys the caller actually set are
 * copied — spreading the raw diff would write `undefined` over real values, since
 * every field on `TUpdateTask` is optional.
 */
const applyDiff = (task: TTask, { id: _id, ...diff }: TUpdateTask): TTask => {
  const provided = Object.fromEntries(
    Object.entries(diff).filter(([, value]) => value !== undefined),
  );
  return { ...task, ...provided };
};

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
  // `?.` on subtasks too, not just task: a bundle running against a database
  // where the migration hasn't landed yet returns rows without the column.
  if (!task?.subtasks?.length) return diff;

  const subtasks = sweepSubtasks(task.subtasks, status);
  const unchanged = subtasks.every(
    (subtask, index) => subtask === task.subtasks[index],
  );

  return unchanged ? diff : { ...diff, subtasks };
};

/**
 * Gives every row in a bulk upsert the same key set. PostgREST rejects a batch
 * whose objects differ in shape (`PGRST102`), which the sweep can cause by
 * adding `subtasks` to only the rows that happen to be completing.
 */
const normalizeBulkKeys = (diffs: TUpdateTask[]): TUpdateTask[] => {
  const keys = new Set(diffs.flatMap((diff) => Object.keys(diff)));
  if (diffs.every((diff) => Object.keys(diff).length === keys.size)) {
    return diffs;
  }

  return diffs.map(
    (diff) =>
      Object.fromEntries(
        [...keys].map((key) => [key, diff[key as keyof TUpdateTask] ?? null]),
      ) as unknown as TUpdateTask,
  );
};

/**
 * When an update completes a repeat task, schedule its next occurrence — the
 * TypeScript replacement for the dropped `create_next_recurring_task` trigger
 * (DEX-21). No-ops unless this update is a fresh transition into done/won't-do
 * on a task linked to a template with a schedule.
 *
 * Reads the task from `previousTasks` — the snapshot `onMutate` took *before*
 * the optimistic write — not from the live cache. The optimistic write has
 * already set the completing status by the time this runs, so a live read would
 * see an already-complete task and skip every recurrence.
 */
const maybeCreateNextRecurringTask = async (
  queryClient: QueryClient,
  diff: TUpdateTask,
  previousTasks: TTask[] | undefined,
): Promise<void> => {
  if (!isCompletionStatus(diff.status)) return;

  const task = findTask(previousTasks, diff.id);
  // Already-complete tasks don't re-spawn (mirrors the trigger's OLD.status
  // guard); a task missing from the snapshot is skipped rather than guessed at.
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

  /**
   * Writes the diff into the `["tasks"]` cache before the request goes out and
   * restores the snapshot if it fails — the same optimistic pattern
   * `usePreferences`, `useDays`, and `useHabits` already use.
   *
   * This is what makes checklist editing correct rather than merely quick.
   * `subtasks` is replaced as a whole array, so any consumer that reads the
   * cached task to build the next array — `withSubtaskSweep` below, and
   * `TaskCard` composing an edit — would otherwise be working from pre-write
   * state and would silently clobber the edit before it.
   */
  const optimisticUpdate = {
    onMutate: async (diff: TUpdateTask) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previousTasks = queryClient.getQueryData<TTask[]>(["tasks"]);

      queryClient.setQueryData<TTask[]>(["tasks"], (current = []) =>
        current.map((task) =>
          task.id === diff.id ? applyDiff(task, diff) : task,
        ),
      );

      return { previousTasks };
    },
    onError: (
      _error: Error,
      _diff: TUpdateTask,
      context: { previousTasks?: TTask[] } | undefined,
    ) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks"], context.previousTasks);
      }
    },
  };

  const { mutate: update } = useMutation<
    TTask[],
    Error,
    TUpdateTask,
    { previousTasks?: TTask[] }
  >({
    mutationFn: (diff) => updateTask(supabase, diff),
    ...optimisticUpdate,
    onSuccess: (_data, diff, context) =>
      maybeCreateNextRecurringTask(queryClient, diff, context?.previousTasks),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  /**
   * Folds the sweep in here rather than inside `mutationFn` so it reads the
   * cache *before* this update's own optimistic write lands — and after any
   * previous one, which is the whole point.
   */
  const updateWithSweep = (diff: TUpdateTask) =>
    update(withSubtaskSweep(queryClient, diff));

  const { mutate: bulkUpdate } = useMutation<TTask[], Error, TUpdateTask[]>({
    mutationFn: (diffs) =>
      updateTasks(
        supabase,
        // PostgREST rejects a bulk upsert whose rows don't share a key set, so
        // every row carries `subtasks` once any of them needs it.
        normalizeBulkKeys(
          diffs.map((diff) => withSubtaskSweep(queryClient, diff)),
        ),
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
      updateTask: updateWithSweep,
      updateTasks: bulkUpdate,
    },
  ];
};
