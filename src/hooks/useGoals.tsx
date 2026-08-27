import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  createGoal,
  deleteGoal,
  getGoals,
  TCreateGoal,
  TGoal,
  TUpdateGoal,
  updateGoal,
} from "@/api/goals";

import { supabase } from "./useAuth";

type TUseGoals = [
  TGoal[],
  {
    createGoal: (goal: TCreateGoal) => void;
    deleteGoal: (id: string) => void;
    getGoalById: (id: string | null) => TGoal | undefined;
    updateGoal: (goal: TUpdateGoal) => void;
  },
];

type THookOptions = {
  skipQuery?: boolean;
};

// Stable reference so consumers that memoize on `goals` don't recompute every
// render while the query is skipped/empty.
const EMPTY_GOALS: TGoal[] = [];

// Exported so launch-time prefetch shares this exact key/fetcher instead of a
// second definition that could drift out of sync.
export const goalsQueryOptions = queryOptions({
  queryKey: ["goals"],
  queryFn: () => getGoals(supabase),
});

export const useGoals = (options?: THookOptions): TUseGoals => {
  const queryClient = useQueryClient();

  const { data: goals = EMPTY_GOALS } = useQuery({
    ...goalsQueryOptions,
    enabled: !options?.skipQuery,
  });

  const { mutate: create } = useMutation<TGoal[], Error, TCreateGoal>({
    mutationFn: ({ title, emoji }) => createGoal(supabase, { title, emoji }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });

  const { mutate: update } = useMutation<TGoal[], Error, TUpdateGoal>({
    mutationFn: (diff) => updateGoal(supabase, diff),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });

  const { mutate: remove } = useMutation<void, Error, string>({
    mutationFn: (id) => deleteGoal(supabase, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });

  const getGoalById = (id: string | null) => {
    if (!id) return undefined;
    return goals.find((goal) => goal.id === id);
  };

  return [
    goals,
    { createGoal: create, deleteGoal: remove, getGoalById, updateGoal: update },
  ];
};
