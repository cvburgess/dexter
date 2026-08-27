import { Temporal } from "@js-temporal/polyfill";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { TQueryFilter } from "@/api/applyFilters";
import {
  createDailyHabit,
  createHabit,
  deleteHabit,
  getDailyHabits,
  getHabits,
  TCreateHabit,
  TDailyHabit,
  THabit,
  TUpdateDailyHabit,
  TUpdateHabit,
  updateDailyHabit,
  updateHabit,
} from "@/api/habits";

import { supabase, useAuth } from "./useAuth";

type TMutateCallbacks = {
  onError?: (error: Error) => void;
  onSuccess?: () => void;
};

type TUseHabits = [
  THabit[],
  {
    createHabit: (habit: TCreateHabit, callbacks?: TMutateCallbacks) => void;
    deleteHabit: (id: string, callbacks?: TMutateCallbacks) => void;
    getHabitById: (id: string | null) => THabit | undefined;
    isLoading: boolean;
    updateHabit: (habit: TUpdateHabit, callbacks?: TMutateCallbacks) => void;
  },
];

type TSupabaseHookOptions = {
  skipQuery?: boolean;
  filters?: TQueryFilter[];
};

// A habit edit can change today's daily rows (pause/archive/days_active
// trigger). Exported so useRealtimeInvalidation shares this pairing.
export const HABITS_INVALIDATION_KEYS = [["habits"], ["dailyHabits"]];

// How far back a day's rows may still be created. Matches the task fetch's
// default reach, which is roughly how far back a user is plausibly catching up.
const HABIT_BOOTSTRAP_WINDOW_DAYS = 30;

// Whether a day's rows may still be instantiated (DEX-162). Bootstrapping is
// a write, so an unbounded window would manufacture false history.
export const canBootstrapDailyHabits = (
  date: Temporal.PlainDate,
  today: Temporal.PlainDate,
): boolean => {
  if (Temporal.PlainDate.compare(date, today) > 0) return false;
  return (
    Temporal.PlainDate.compare(
      date,
      today.subtract({ days: HABIT_BOOTSTRAP_WINDOW_DAYS }),
    ) >= 0
  );
};

const dailyHabitsQueryOptions = (date: string) =>
  queryOptions({
    queryKey: ["dailyHabits", date],
    queryFn: () => getDailyHabits(supabase, date),
    retry: false,
  });

// One day's rows for useWidgetSync (DEX-160). useDailyHabits can't serve it —
// skipQuery would add a second fetch on every non-Today tab. Never bootstraps.
export const useDailyHabitProgress = (
  date: string,
): { dailyHabits: TDailyHabit[]; isLoading: boolean } => {
  const { userId } = useAuth();

  const { data, isPending } = useQuery({
    ...dailyHabitsQueryOptions(date),
    enabled: !!userId,
  });

  return {
    dailyHabits: data ?? [],
    // Paired with `userId`: a disabled query never leaves `pending`, which
    // would otherwise report loading forever while signed out.
    isLoading: !!userId && isPending,
  };
};

export const useHabits = (options?: TSupabaseHookOptions): TUseHabits => {
  const queryClient = useQueryClient();

  const { data: habits = [], isLoading } = useQuery({
    enabled: !options?.skipQuery,
    queryKey: ["habits", options?.filters],
    queryFn: () => getHabits(supabase, options?.filters),
  });

  const invalidateHabits = () => {
    HABITS_INVALIDATION_KEYS.forEach((queryKey) => {
      void queryClient.invalidateQueries({ queryKey });
    });
  };

  const { mutate: create } = useMutation<THabit, Error, TCreateHabit>({
    mutationFn: (habit) => createHabit(supabase, habit),
    onSuccess: invalidateHabits,
  });

  const { mutate: update } = useMutation<THabit, Error, TUpdateHabit>({
    mutationFn: (diff) => updateHabit(supabase, diff),
    onSuccess: invalidateHabits,
  });

  const { mutate: remove } = useMutation<void, Error, string>({
    mutationFn: (id) => deleteHabit(supabase, id),
    onSuccess: invalidateHabits,
  });

  const getHabitById = (id: string | null) => {
    if (!id) return undefined;
    return habits.find((habit) => habit.id === id);
  };

  return [
    habits,
    {
      createHabit: create,
      deleteHabit: remove,
      getHabitById,
      isLoading,
      updateHabit: update,
    },
  ];
};

type TUseDailyHabits = [
  TDailyHabit[],
  {
    createDailyHabits: () => void;
    incrementDailyHabit: (dailyHabit: TDailyHabit) => void;
    isLoading: boolean;
  },
];

// `skipQuery` silences this read and the inner useHabits (DEX-148); mutations
// stay wired regardless — unreachable when skipped, but no silent no-op.
export const useDailyHabits = (
  date: string,
  options?: { skipQuery?: boolean },
): TUseDailyHabits => {
  const queryClient = useQueryClient();
  const [habits] = useHabits({
    skipQuery: options?.skipQuery,
    filters: [
      ...habitFilters.notPaused,
      ...habitFilters.activeForDay(Temporal.PlainDate.from(date).dayOfWeek),
    ],
  });

  const { data: dailyHabits = [], isLoading } = useQuery({
    ...dailyHabitsQueryOptions(date),
    enabled: !options?.skipQuery,
  });

  const { mutate: create } = useMutation<void, Error>({
    mutationFn: async () => {
      const today = Temporal.Now.plainDateISO();

      if (
        isLoading ||
        !canBootstrapDailyHabits(Temporal.PlainDate.from(date), today)
      ) {
        throw new Error("Cannot create daily habits for this date");
      }

      const getDailyHabit = (habit: THabit) => {
        return dailyHabits.find(
          (dailyHabit) => dailyHabit.habitId === habit.id,
        );
      };

      const missingHabits = habits.filter((habit) => !getDailyHabit(habit));

      if (missingHabits.length === 0) throw new Error("No missing habits");

      await Promise.all(
        missingHabits.map((habit) =>
          createDailyHabit(supabase, {
            date: date.toString(),
            habitId: habit.id,
            steps: habit.steps,
            stepsComplete: 0,
          }),
        ),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["dailyHabits", date],
      });
    },
  });

  const { mutate: update } = useMutation<
    TDailyHabit,
    Error,
    TUpdateDailyHabit,
    { previous?: TDailyHabit[] }
  >({
    mutationFn: (diff) => updateDailyHabit(supabase, diff),
    // Write the step count into the cache immediately — otherwise a second
    // tap before the refetch reuses the stale snapshot and drops the step.
    onMutate: async (diff) => {
      await queryClient.cancelQueries({ queryKey: ["dailyHabits", date] });
      const previous = queryClient.getQueryData<TDailyHabit[]>([
        "dailyHabits",
        date,
      ]);
      if (diff.stepsComplete !== undefined) {
        queryClient.setQueryData<TDailyHabit[]>(
          ["dailyHabits", date],
          (rows = []) =>
            rows.map((row) =>
              row.date === diff.date && row.habitId === diff.habitId
                ? {
                    ...row,
                    stepsComplete: diff.stepsComplete!,
                    percentComplete: Math.round(
                      (100 * diff.stepsComplete!) / row.steps,
                    ),
                  }
                : row,
            ),
        );
      }
      return { previous };
    },
    onError: (_error, _diff, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["dailyHabits", date], context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["dailyHabits", date] });
    },
  });

  const incrementDailyHabit = (dailyHabit: TDailyHabit) => {
    // Derive from the freshest cached row, not the ring's last-render snapshot
    // — otherwise two taps before a re-render both repeat the same step.
    const rows = queryClient.getQueryData<TDailyHabit[]>(["dailyHabits", date]);
    const current =
      rows?.find((row) => row.habitId === dailyHabit.habitId) ?? dailyHabit;
    const { date: dailyHabitDate, habitId, steps, stepsComplete } = current;
    const next = stepsComplete === steps ? 0 : stepsComplete + 1;

    update({ date: dailyHabitDate, habitId, stepsComplete: next });
  };

  return [
    dailyHabits,
    { createDailyHabits: create, incrementDailyHabit, isLoading },
  ];
};

export const habitFilters = {
  notPaused: [["isPaused", "eq", false]] as TQueryFilter[],
  activeForDay: (day: number) =>
    [["daysActive", "contains", [day]]] as TQueryFilter[],
};
