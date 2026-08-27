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
  hasOpenTaskForTemplate,
  TCreateTask,
  TTask,
  TUpdateTask,
  updateTask,
  updateTasks,
} from "@/api/tasks";
import { getTemplates, TTemplate } from "@/api/templates";
import { getNextTaskDate } from "@/utils/repeatSchedule";
import { completeSubtasks, subtasksFromTemplate } from "@/utils/subtasks";
import { isCompletionStatus } from "@/utils/taskFilters";
import { DEFAULT_TASK_REACH_DAYS } from "@/utils/taskReach";
import { OPEN_TASK_STATUSES } from "@/utils/taskStatus";

import { supabase } from "./useAuth";
import { FOCUS_BLOCKS_INVALIDATION_KEYS } from "./useFocusBlocks";
import { useTaskReach } from "./useTaskReach";

type TMutateCallbacks = {
  onError?: (error: Error) => void;
  onSuccess?: () => void;
};

type TUseTasks = [
  TTask[],
  {
    createTask: (task: TCreateTask, callbacks?: TMutateCallbacks) => void;
    deleteTask: (id: string) => void;
    /** The canonical fetch failed. Distinct from empty: on error tasks is
     * [] and isLoading false, which reads as "you have no tasks" (DEX-100). */
    isError: boolean;
    /** No settled rows for the current reach — first load, or a reach
     * widening (DEX-162). Reconcilers (alarm/widget sync) wait it out. */
    isLoading: boolean;
    /** Re-runs the canonical fetch; the retry behind a failed load. */
    refetch: () => void;
    updateTask: (task: TUpdateTask, callbacks?: TMutateCallbacks) => void;
    updateTasks: (tasks: TUpdateTask[]) => void;
  },
];

type TSupabaseHookOptions = {
  skipQuery?: boolean;
};

const getToday = () => Temporal.Now.plainDateISO();

// Cache key carries the reach (DEX-162) so widening reads as isLoading.
// Invalidation stays on the bare ["tasks"] prefix to match any reach.
export const tasksQueryKey = (reach: Temporal.PlainDate) => [
  "tasks",
  reach.toString(),
];

/** Finds a task in the canonical cache entry. */
const findCachedTask = (
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  id: string,
): TTask | undefined =>
  queryClient.getQueryData<TTask[]>(queryKey)?.find((task) => task.id === id);

/** Finds a task in a snapshot taken before an optimistic write. */
const findTask = (tasks: TTask[] | undefined, id: string): TTask | undefined =>
  tasks?.find((task) => task.id === id);

// Applies an update diff to a cached task. Only keys the caller set are
// copied — spreading the raw diff would write undefined over real values.
const applyDiff = (task: TTask, { id: _id, ...diff }: TUpdateTask): TTask => {
  const provided = Object.fromEntries(
    Object.entries(diff).filter(([, value]) => value !== undefined),
  );
  return { ...task, ...provided };
};

// Folds the subtask sweep into a completing update so parent and checklist
// close in one row write. Any terminal status sweeps; explicit subtasks wins.
const withSubtaskSweep = (
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  diff: TUpdateTask,
): TUpdateTask => {
  if (!isCompletionStatus(diff.status) || diff.subtasks) return diff;

  const task = findCachedTask(queryClient, queryKey, diff.id);
  // `?.` on subtasks too, not just task: a bundle running against a database
  // where the migration hasn't landed yet returns rows without the column.
  if (!task?.subtasks?.length) return diff;

  const subtasks = completeSubtasks(task.subtasks);
  const unchanged = subtasks.every(
    (subtask, index) => subtask === task.subtasks[index],
  );

  return unchanged ? diff : { ...diff, subtasks };
};

// Pads every row in a bulk upsert to one key set (PostgREST rejects mixed
// shapes, PGRST102) from cached values — a null pad would really clear.
const normalizeBulkKeys = (
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  diffs: TUpdateTask[],
): TUpdateTask[] => {
  const keys = new Set(diffs.flatMap((diff) => Object.keys(diff)));
  if (diffs.every((diff) => Object.keys(diff).length === keys.size)) {
    return diffs;
  }

  return diffs.map((diff) => {
    const cached = findCachedTask(queryClient, queryKey, diff.id);

    return Object.fromEntries(
      [...keys].map((key) => [
        key,
        // `in`, not `??`: an explicit null clearing a column must not read
        // as "missing"; `null` is the last resort for a row absent from cache.
        key in diff
          ? diff[key as keyof TUpdateTask]
          : (cached?.[key as keyof TTask] ?? null),
      ]),
    ) as unknown as TUpdateTask;
  });
};

// Completing a repeat schedules its next occurrence (replaces the DEX-21
// trigger); reads the pre-optimistic snapshot, or recurrence gets skipped.
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

  // A repeat has exactly one open task; safe post-write since the completing
  // task is already terminal server-side and can't match its own guard.
  if (await hasOpenTaskForTemplate(supabase, template.id)) return;

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
    // Each occurrence gets its own copy of the checklist, all unchecked. Array
    // items carry no template link, so there is no orphan-spawn hazard here.
    subtasks: subtasksFromTemplate(template.subtasks),
  });
};

// The one fetch every view filters client-side (DEX-57): open tasks plus
// any task scheduled on/after reach, which widens as older days open (DEX-162).
export const canonicalTaskFilters = (
  reach: Temporal.PlainDate = getToday().subtract({
    days: DEFAULT_TASK_REACH_DAYS,
  }),
): TQueryFilter[] => [
  makeOrFilter([
    ["status", "in", OPEN_TASK_STATUSES],
    ["scheduledFor", "gte", reach.toString()],
  ]),
];

// useRealtimeInvalidation checks this key to skip refetching while our own
// write is in flight (its echo could stamp stale rows over a newer edit).
export const TASKS_MUTATION_KEY = ["tasks"];

export const useTasks = (options?: TSupabaseHookOptions): TUseTasks => {
  const queryClient = useQueryClient();
  const reach = useTaskReach();
  const queryKey = tasksQueryKey(reach);

  const {
    data: tasks = [],
    isError,
    isPlaceholderData,
    refetch,
  } = useQuery({
    enabled: !options?.skipQuery,
    // Widening the reach changes the key; an empty placeholder would blank
    // every view for the round trip (`isPlaceholderData` still reports it).
    placeholderData: (previous: TTask[] | undefined) => previous ?? [],
    queryKey,
    queryFn: () => getTasks(supabase, canonicalTaskFilters(reach)),
  });

  const { mutate: create } = useMutation<TTask[], Error, TCreateTask>({
    mutationKey: TASKS_MUTATION_KEY,
    mutationFn: (task) => createTask(supabase, task),
    // On settle, not success: this is the catch-up useRealtimeInvalidation
    // counts on for the remote events it dropped mid-mutation.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  // Optimistic write + rollback (mirrors usePreferences/useNotes/useHabits).
  // Consumers building the next subtasks array must see post-write state.
  const optimisticUpdate = {
    onMutate: async (diff: TUpdateTask) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previousTasks = queryClient.getQueryData<TTask[]>(queryKey);

      queryClient.setQueryData<TTask[]>(queryKey, (current = []) =>
        current.map((task) =>
          task.id === diff.id ? applyDiff(task, diff) : task,
        ),
      );

      // The key travels with the snapshot: the reach can widen mid-flight, and
      // rollback must restore the entry it snapshotted, not the current one.
      return { previousTasks, queryKey };
    },
    onError: (
      _error: Error,
      _diff: TUpdateTask,
      context:
        { previousTasks?: TTask[]; queryKey?: readonly unknown[] } | undefined,
    ) => {
      if (context?.previousTasks && context.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousTasks);
      }
    },
  };

  const { mutate: update } = useMutation<
    TTask[],
    Error,
    TUpdateTask,
    { previousTasks?: TTask[]; queryKey?: readonly unknown[] }
  >({
    mutationKey: TASKS_MUTATION_KEY,
    mutationFn: (diff) => updateTask(supabase, diff),
    ...optimisticUpdate,
    onSuccess: (_data, diff, context) =>
      maybeCreateNextRecurringTask(queryClient, diff, context?.previousTasks),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  // Sweep folded here, not in mutationFn, to read the cache before this
  // write's optimistic land. callbacks forward per-call options (DEX-98).
  const updateWithSweep = (diff: TUpdateTask, callbacks?: TMutateCallbacks) =>
    update(withSubtaskSweep(queryClient, queryKey, diff), callbacks);

  const { mutate: bulkUpdate } = useMutation<TTask[], Error, TUpdateTask[]>({
    mutationKey: TASKS_MUTATION_KEY,
    mutationFn: (diffs) =>
      updateTasks(
        supabase,
        // PostgREST rejects a bulk upsert whose rows don't share a key set, so
        // every row carries `subtasks` once any of them needs it.
        normalizeBulkKeys(
          queryClient,
          queryKey,
          diffs.map((diff) => withSubtaskSweep(queryClient, queryKey, diff)),
        ),
      ),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const { mutate: remove } = useMutation<void, Error, string>({
    mutationKey: TASKS_MUTATION_KEY,
    mutationFn: (id) => deleteTask(supabase, id),
    // On settle, for the same reason as `create` above.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      // `focus_blocks.task_id` cascades and realtime can't report it (a DELETE
      // carries PK columns only — docs/backend.md), so invalidate explicitly.
      FOCUS_BLOCKS_INVALIDATION_KEYS.forEach((queryKey) => {
        void queryClient.invalidateQueries({ queryKey });
      });
    },
  });

  return [
    tasks,
    {
      createTask: create,
      deleteTask: remove,
      isError,
      isLoading: isPlaceholderData,
      // Swallows the promise so a caller can hand this straight to an `onPress`
      // — the refetch's own result is already in `tasks`/`isError`.
      refetch: () => void refetch(),
      updateTask: updateWithSweep,
      updateTasks: bulkUpdate,
    },
  ];
};
