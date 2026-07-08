import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  EThemeMode,
  getPreferences,
  TPreferences,
  TUpdatePreferences,
  updatePreferences,
} from "@/api/preferences";

import { supabase, useAuth } from "./useAuth";

type TUsePreferences = [
  TPreferences,
  {
    updatePreferences: (
      preferences: Omit<TUpdatePreferences, "userId">,
    ) => void;
  },
];

type THookOptions = {
  skipQuery?: boolean;
};

export const usePreferences = (options?: THookOptions): TUsePreferences => {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    // Gate on `userId` so unauthenticated screens (e.g. login, which still call
    // `useTheme` → `ThemeProvider`) don't fire a preferences query that RLS
    // would reject.
    enabled: !!userId && !options?.skipQuery,
    placeholderData: defaultPreferences,
    queryKey: ["preferences"],
    queryFn: () => getPreferences(supabase),
    staleTime: 1000 * 60 * 10,
  });

  // Ignore any cached row when signed out — the `["preferences"]` cache isn't
  // always cleared on session loss (only the Log Out button clears it), so a
  // stale row could otherwise leak the previous account's theme onto the login
  // screen instead of the OS-driven `defaultPreferences`.
  const preferences = userId
    ? (data ?? defaultPreferences)
    : defaultPreferences;

  const { mutate: update } = useMutation<
    TPreferences,
    Error,
    Omit<TUpdatePreferences, "userId">
  >({
    mutationFn: (diff) => {
      if (!userId) throw new Error("Cannot update preferences without a user");
      return updatePreferences(supabase, { userId, ...diff });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["preferences"] });
    },
  });

  return [preferences, { updatePreferences: update }];
};

const defaultPreferences: TPreferences = {
  calendarEndTime: "20:00:00",
  calendarStartTime: "06:00:00",
  calendarUrls: [],
  darkTheme: "dark",
  enableCalendar: false,
  enableHabits: true,
  enableJournal: true,
  enableNotes: true,
  lightTheme: "dexter",
  templateNote: "",
  templatePrompts: [],
  themeMode: EThemeMode.SYSTEM,
};
