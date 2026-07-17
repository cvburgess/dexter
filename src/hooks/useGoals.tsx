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

// A stable reference (rather than an inline `= []` default, which creates a
// new array every render) so consumers that memoize on `goals` don't
// recompute on every render while the query is skipped/empty.
const EMPTY_GOALS: TGoal[] = [];

// Exported so callers that need to warm this cache ahead of a mount (e.g.
// `(app)/_layout.tsx`'s launch-time prefetch) share the exact key/fetcher/
// staleTime this hook uses, instead of a second hand-copied definition that
// could drift out of sync with this one.
export const goalsQueryOptions = queryOptions({
  queryKey: ["goals"],
  queryFn: () => getGoals(supabase),
  staleTime: 1000 * 60 * 10,
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
