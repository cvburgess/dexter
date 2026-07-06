import { Temporal } from "@js-temporal/polyfill";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export const taskFilters: Record<string, TQueryFilter[]> = {
  get today(): TQueryFilter[] {
    return taskFiltersForDate(getToday());
  },
  incomplete: [["status", "in", [ETaskStatus.TODO, ETaskStatus.IN_PROGRESS]]],
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
    const today = getToday();

    return [
      makeOrFilter([
        ["scheduledFor", "neq", today.toString()],
        ["scheduledFor", "is", null],
      ]),
      ...this.incomplete,
    ];
  },
  get noGoal(): TQueryFilter[] {
    return [["goalId", "is", null], ...this.incomplete];
  },
};
