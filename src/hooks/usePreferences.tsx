import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  EThemeMode,
  getPreferences,
  TPreferences,
  TUpdatePreferences,
  updatePreferences,
} from "@/api/preferences";
import { DEFAULT_ALARM_SOUND } from "@/utils/alarms";

import { supabase, useAuth } from "./useAuth";

const defaultPreferences: TPreferences = {
  alarmSound: DEFAULT_ALARM_SOUND,
  calendarEndTime: "20:00:00",
  calendarStartTime: "06:00:00",
  calendarUrls: [],
  darkTheme: "dark",
  enableCalendar: false,
  enableHabits: true,
  enableJournal: true,
  enableNotes: true,
  lightTheme: "dexter",
  // No sign until the user picks one (DEX-128) — see `TPreferences.sunSign`.
  sunSign: null,
  templateNote: "",
  templatePrompts: [],
  themeMode: EThemeMode.SYSTEM,
};

const preferencesQueryOptions = queryOptions({
  placeholderData: defaultPreferences,
  queryKey: ["preferences"],
  queryFn: () => getPreferences(supabase),
});

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
    ...preferencesQueryOptions,
    // Gate on `userId` so unauthenticated screens (e.g. login, which still call
    // `useTheme` → `ThemeProvider`) don't fire a preferences query that RLS
    // would reject.
    enabled: !!userId && !options?.skipQuery,
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
    Omit<TUpdatePreferences, "userId">,
    { previous?: TPreferences }
  >({
    mutationFn: (diff) => {
      if (!userId) throw new Error("Cannot update preferences without a user");
      return updatePreferences(supabase, { userId, ...diff });
    },
    // Optimistically write the change into the cache so the app re-themes
    // immediately instead of waiting for the round-trip + refetch; roll back if
    // the save fails.
    onMutate: async (diff) => {
      await queryClient.cancelQueries({ queryKey: ["preferences"] });
      const previous = queryClient.getQueryData<TPreferences>(["preferences"]);
      queryClient.setQueryData<TPreferences>(["preferences"], {
        ...(previous ?? defaultPreferences),
        ...diff,
      });
      return { previous };
    },
    onError: (_error, _diff, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["preferences"], context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["preferences"] });
    },
  });

  return [preferences, { updatePreferences: update }];
};

/**
 * Just the alarm sound, for `useAlarmSync` (DEX-72). Separate from
 * `usePreferences` for two reasons: `isLoading` matters here and nowhere else —
 * scheduling on the placeholder would ring every alarm with the default sound
 * and then re-schedule the lot once the saved row lands — and `select` narrows
 * the subscription, so the root of the authenticated tree doesn't re-render on
 * every unrelated preference edit (a theme toggle, a calendar URL).
 */
export const useAlarmSoundPreference = (): {
  alarmSound: string;
  isLoading: boolean;
} => {
  const { userId } = useAuth();

  const { data, isPlaceholderData } = useQuery({
    ...preferencesQueryOptions,
    enabled: !!userId,
    select: (preferences) => preferences.alarmSound,
  });

  return {
    alarmSound: data ?? DEFAULT_ALARM_SOUND,
    // `isPlaceholderData` is also true while the query is *disabled* (it never
    // leaves `pending`), so it has to be paired with `userId` — otherwise the
    // hook reports "still loading" forever whenever there's no session, and the
    // sync that cancels a departing user's alarms would never run.
    isLoading: !!userId && isPlaceholderData,
  };
};
