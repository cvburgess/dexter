import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createList,
  deleteList,
  getLists,
  TCreateList,
  TList,
  TUpdateList,
  updateList,
} from "@/api/lists";

import { supabase } from "./useAuth";

type TUseLists = [
  TList[],
  {
    createList: (list: TCreateList) => void;
    deleteList: (id: string) => void;
    getListById: (id: string | null) => TList | undefined;
    isLoading: boolean;
    updateList: (list: TUpdateList) => void;
  },
];

type THookOptions = {
  skipQuery?: boolean;
};

// A stable reference (rather than an inline `= []` default, which creates a
// new array every render) so consumers that memoize on `lists` don't
// recompute on every render while the query is skipped/empty.
const EMPTY_LISTS: TList[] = [];

export const useLists = (options?: THookOptions): TUseLists => {
  const queryClient = useQueryClient();

  const { data: lists = EMPTY_LISTS, isPending } = useQuery({
    enabled: !options?.skipQuery,
    queryKey: ["lists"],
    queryFn: () => getLists(supabase),
    staleTime: 1000 * 60 * 10,
  });

  const { mutate: create } = useMutation<TList[], Error, TCreateList>({
    mutationFn: ({ title, emoji }) => createList(supabase, { title, emoji }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  });

  const { mutate: update } = useMutation<TList[], Error, TUpdateList>({
    mutationFn: (diff) => updateList(supabase, diff),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  });

  const { mutate: remove } = useMutation<void, Error, string>({
    mutationFn: (id) => deleteList(supabase, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  });

  const getListById = (id: string | null) => {
    if (!id) return undefined;
    return lists.find((list) => list.id === id);
  };

  return [
    lists,
    {
      createList: create,
      deleteList: remove,
      getListById,
      isLoading: isPending,
      updateList: update,
    },
  ];
};
