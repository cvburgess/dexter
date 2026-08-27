import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { TSunSign } from "@/api/horoscopes";
import {
  EThemeMode,
  getPreferences,
  TPreferences,
  TUpdatePreferences,
  updatePreferences,
} from "@/api/preferences";
import { DEFAULT_ALARM_SOUND } from "@/utils/alarms";
import {
  DEFAULT_BREATH_COUNT,
  DEFAULT_BREATHING_TECHNIQUE,
} from "@/utils/breathing";
import { DEFAULT_FOCUS_BLOCK_MINUTES } from "@/utils/focusBlocks";

import { supabase, useAuth } from "./useAuth";

const defaultPreferences: TPreferences = {
  alarmSound: DEFAULT_ALARM_SOUND,
  breathCount: DEFAULT_BREATH_COUNT,
  breathingTechnique: DEFAULT_BREATHING_TECHNIQUE,
  calendarEndTime: "20:00:00",
  calendarStartTime: "06:00:00",
  calendarUrls: [],
  darkTheme: "dark",
  enableCalendar: false,
  enableHabits: true,
  enableHoroscope: true,
  enableJournal: true,
  enableNotes: true,
  focusBlockMinutes: DEFAULT_FOCUS_BLOCK_MINUTES,
  lightTheme: "dexter",
  // No sign until the user picks one (DEX-128) — see `TPreferences.sunSign`.
  sunSign: null,
  templateNote: "",
  templatePrompts: [],
  themeMode: EThemeMode.SYSTEM,
};

/** Exported so `useFocusBlocks` can `ensureQueryData` the block length at
 * start time, instead of an observer on every task card re-rendering the list. */
export const preferencesQueryOptions = queryOptions({
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
    // Unauthenticated screens (login → useTheme → ThemeProvider) still call
    // this; gate on userId so they don't fire a query RLS would reject.
    enabled: !!userId && !options?.skipQuery,
  });

  // Ignore any cached row when signed out — only Log Out clears the cache, so
  // a stale row could leak the previous account's theme onto the login screen.
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
    // Write optimistically so the app re-themes immediately; roll back on error.
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

/** Just the sun sign, for the Horoscope step (DEX-128). `null` is meaningful
 * placeholder data — without `isLoading`, every user flashes "pick your sign". */
export const useSunSignPreference = (): {
  sunSign: TSunSign | null;
  isLoading: boolean;
} => {
  const { userId } = useAuth();

  const { data, isPlaceholderData } = useQuery({
    ...preferencesQueryOptions,
    enabled: !!userId,
    select: (preferences) => preferences.sunSign,
  });

  return {
    sunSign: data ?? null,
    // Paired with userId: a *disabled* query never leaves `pending`, so
    // isPlaceholderData alone would report "loading" forever when signed out.
    isLoading: !!userId && isPlaceholderData,
  };
};

/** The three fields `resolveTheme` reads, for `useWidgetSync` (DEX-83) — flat
 * primitives so an effect doesn't re-fire on an equal rebuilt object. */
export const useThemePreferences = (): {
  themeMode: EThemeMode;
  lightTheme: string;
  darkTheme: string;
  isLoading: boolean;
} => {
  const { userId } = useAuth();

  const { data, isPlaceholderData } = useQuery({
    ...preferencesQueryOptions,
    enabled: !!userId,
    select: ({ themeMode, lightTheme, darkTheme }) => ({
      themeMode,
      lightTheme,
      darkTheme,
    }),
  });

  return {
    themeMode: data?.themeMode ?? defaultPreferences.themeMode,
    lightTheme: data?.lightTheme ?? defaultPreferences.lightTheme,
    darkTheme: data?.darkTheme ?? defaultPreferences.darkTheme,
    // Publishing the placeholder would paint every widget default then spend a
    // second reload repainting once the saved row lands.
    isLoading: !!userId && isPlaceholderData,
  };
};

/** Just the alarm sound, for `useAlarmSync` (DEX-72) — scheduling on the
 * placeholder would ring every alarm default, then re-schedule on load. */
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
    // Paired with userId or the sync that cancels a departing user's alarms
    // would never run — a disabled query never leaves `pending`.
    isLoading: !!userId && isPlaceholderData,
  };
};

/** Just the habits switch, for `useWidgetSync` (DEX-160) — same `userId`
 * pairing as `useAlarmSoundPreference`, for the same reason. */
export const useHabitsEnabledPreference = (): {
  enableHabits: boolean;
  isLoading: boolean;
} => {
  const { userId } = useAuth();

  const { data, isPlaceholderData } = useQuery({
    ...preferencesQueryOptions,
    enabled: !!userId,
    select: (preferences) => preferences.enableHabits,
  });

  return {
    enableHabits: data ?? defaultPreferences.enableHabits,
    isLoading: !!userId && isPlaceholderData,
  };
};
