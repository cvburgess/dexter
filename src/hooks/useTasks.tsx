import { Temporal } from "@js-temporal/polyfill";
import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";

import { makeOrFilter, TQueryFilter } from "@/api/applyFilters";
import {
  createTask,
  deleteTask,
  ETaskPriority,
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
  filters?: TQueryFilter[];
};

const TASKS_STALE_TIME_MS = 1000 * 60 * 10;

const isCompletionStatus = (status: ETaskStatus | undefined): boolean =>
  status === ETaskStatus.DONE || status === ETaskStatus.WONT_DO;

/** Finds a cached task across every `["tasks", ...]` query, regardless of filters. */
const findCachedTask = (
  queryClient: QueryClient,
  id: string,
): TTask | undefined => {
  for (const [, tasks] of queryClient.getQueriesData<TTask[]>({
    queryKey: ["tasks"],
  })) {
    const found = tasks?.find((task) => task.id === id);
    if (found) return found;
  }
  return undefined;
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
    priority: template.priority,
    listId: template.listId,
    goalId: template.goalId,
    scheduledFor: nextDate,
    templateId: template.id,
    status: ETaskStatus.TODO,
  });
};

export const useTasks = (options?: TSupabaseHookOptions): TUseTasks => {
  const queryClient = useQueryClient();

  const { data: tasks = [], isPlaceholderData } = useQuery({
    enabled: !options?.skipQuery,
    placeholderData: [],
    queryKey: ["tasks", options?.filters],
    queryFn: () => getTasks(supabase, options?.filters),
    staleTime: TASKS_STALE_TIME_MS,
  });

  const { mutate: create } = useMutation<TTask[], Error, TCreateTask>({
    mutationFn: (task) => createTask(supabase, task),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const { mutate: update } = useMutation<TTask[], Error, TUpdateTask>({
    mutationFn: (diff) => updateTask(supabase, diff),
    onSuccess: (_data, diff) => maybeCreateNextRecurringTask(queryClient, diff),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const { mutate: bulkUpdate } = useMutation<TTask[], Error, TUpdateTask[]>({
    mutationFn: (diffs) => updateTasks(supabase, diffs),
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

const getToday = () => Temporal.Now.plainDateISO();

export const taskFiltersForDate = (
  date: Temporal.PlainDate,
): TQueryFilter[] => [["scheduledFor", "eq", date.toString()]];

/** Warms the React Query cache for the day before and after `date` so swiping between them feels instant. */
export const usePrefetchAdjacentTasks = (date: Temporal.PlainDate): void => {
  const queryClient = useQueryClient();
  const iso = date.toString();

  useEffect(() => {
    for (const day of [date.add({ days: 1 }), date.subtract({ days: 1 })]) {
      const filters = taskFiltersForDate(day);
      void queryClient.prefetchQuery({
        queryKey: ["tasks", filters],
        queryFn: () => getTasks(supabase, filters),
        staleTime: TASKS_STALE_TIME_MS,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso]);
};

const INCOMPLETE_FILTER: TQueryFilter[] = [
  ["status", "in", [ETaskStatus.TODO, ETaskStatus.IN_PROGRESS]],
];

/**
 * Incomplete tasks unscheduled or scheduled for a day other than `date` — the
 * Today-tab task drawer's base scope (DEX-33). Parameterized (unlike
 * `taskFilters.notToday`, which is always relative to the real current date)
 * so the drawer can query "not on this day" for whichever day is being viewed.
 */
export const notScheduledForDateFilters = (
  date: Temporal.PlainDate,
): TQueryFilter[] => [
  makeOrFilter([
    ["scheduledFor", "neq", date.toString()],
    ["scheduledFor", "is", null],
  ]),
  ...INCOMPLETE_FILTER,
];

export const taskFilters: Record<string, TQueryFilter[]> = {
  get today(): TQueryFilter[] {
    return taskFiltersForDate(getToday());
  },
  incomplete: INCOMPLETE_FILTER,
  get unprioritized(): TQueryFilter[] {
    return [
      ["priority", "eq", ETaskPriority.UNPRIORITIZED],
      ...this.incomplete,
    ];
  },
  get overdue(): TQueryFilter[] {
    const today = getToday();

    return [["dueOn", "lt", today.toString()], ...this.incomplete];
  },
  get dueSoon(): TQueryFilter[] {
    const today = getToday();

    return [
      ["dueOn", "gte", today.toString()],
      ["dueOn", "lte", today.add({ days: 13 }).toString()],
      ...this.incomplete,
    ];
  },
  get unscheduled(): TQueryFilter[] {
    return [["scheduledFor", "is", null], ...this.incomplete];
  },
  get leftBehind(): TQueryFilter[] {
    const today = getToday();

    return [["scheduledFor", "lt", today.toString()], ...this.incomplete];
  },
  get notToday(): TQueryFilter[] {
    return notScheduledForDateFilters(getToday());
  },
  get noGoal(): TQueryFilter[] {
    return [["goalId", "is", null], ...this.incomplete];
  },
};
