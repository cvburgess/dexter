import { Temporal } from "@js-temporal/polyfill";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

import { supabase } from "./useAuth";

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

export const useHabits = (options?: TSupabaseHookOptions): TUseHabits => {
  const queryClient = useQueryClient();

  const { data: habits = [], isLoading } = useQuery({
    enabled: !options?.skipQuery,
    queryKey: ["habits", options?.filters],
    queryFn: () => getHabits(supabase, options?.filters),
    staleTime: 1000 * 60 * 10,
  });

  // A habit edit can change today's daily rows — the DB trigger deletes them on
  // pause/archive or a days_active change, and the dailyHabits join carries the
  // habit's emoji/title. Invalidate both caches so the Today tracker stays fresh.
  const invalidateHabits = () => {
    void queryClient.invalidateQueries({ queryKey: ["habits"] });
    void queryClient.invalidateQueries({ queryKey: ["dailyHabits"] });
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

export const useDailyHabits = (date: string): TUseDailyHabits => {
  const queryClient = useQueryClient();
  const [habits] = useHabits({
    filters: [
      ...habitFilters.notPaused,
      ...habitFilters.activeForDay(Temporal.PlainDate.from(date).dayOfWeek),
    ],
  });

  const { data: dailyHabits = [], isLoading } = useQuery({
    queryKey: ["dailyHabits", date],
    queryFn: () => getDailyHabits(supabase, date),
    retry: false,
    staleTime: 1000 * 60 * 10,
  });

  const { mutate: create } = useMutation<void, Error>({
    mutationFn: async () => {
      const today = Temporal.Now.plainDateISO();
      const isFutureDate = Temporal.PlainDate.compare(date, today) > 0;

      if (isLoading || isFutureDate) {
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
    // Write the new step count into the cache immediately so back-to-back taps
    // each read fresh progress. Without this, a second tap before the refetch
    // reuses the stale snapshot and drops the step.
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
    // Derive the next value from the freshest cached row, not the snapshot the
    // ring captured on its last render — otherwise two taps before a re-render
    // both compute from the same stepsComplete and repeat a step. onMutate keeps
    // this cache current between taps.
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
