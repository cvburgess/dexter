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
  templatePromptsPm: [],
  themeMode: EThemeMode.SYSTEM,
};

/** Exported so a mutation can `ensureQueryData` the saved row on demand —
 * `useFocusBlocks` needs the focus block length at the moment a block starts,
 * and adding an observer to every task card's menu just to read it would
 * re-render the whole list on any unrelated preference edit. */
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
 * Just the sun sign, for the Horoscope ritual step (DEX-128). Separate from
 * `usePreferences` for the same two reasons `useAlarmSoundPreference` is.
 *
 * `isLoading` is the load-bearing half. `defaultPreferences` carries
 * `sunSign: null` as placeholder data, and `null` is a *meaningful* value here —
 * it renders the "pick your sign" prompt and its button. Reading the
 * placeholder would flash that prompt at every user who already has a sign, on
 * every cold open, before flipping to their horoscope. And `select` narrows the
 * subscription, so a step that is on screen for the length of a ritual doesn't
 * re-render on an unrelated preference edit.
 */
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
    // Paired with `userId` because a *disabled* query never leaves `pending`
    // and so reports `isPlaceholderData` forever — see
    // `useAlarmSoundPreference`, which pairs them for the same reason.
    isLoading: !!userId && isPlaceholderData,
  };
};

/**
 * Just the three fields `resolveTheme` reads, for `useWidgetSync` (DEX-83).
 * Separate from `usePreferences` for the same two reasons
 * `useAlarmSoundPreference` is — and returned as flat primitives rather than a
 * settings object so an effect can depend on them without re-firing on a `select`
 * that rebuilt an equal object.
 *
 * `isLoading` earns its place the same way: publishing the placeholder would
 * paint every widget in the default `dexter`/`dark` palettes and then spend a
 * second reload repainting them once the saved row lands.
 */
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
    // Paired with `userId` for the reason spelled out in
    // `useAlarmSoundPreference`: a disabled query never leaves `pending`, so
    // `isPlaceholderData` alone would report "still loading" forever when
    // signed out and the sign-out clear would never run.
    isLoading: !!userId && isPlaceholderData,
  };
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

/**
 * Just the habits switch, for `useWidgetSync` (DEX-160).
 *
 * Same shape and same `userId` pairing as `useAlarmSoundPreference`, for the
 * same two reasons: publishing rings off the `true` placeholder would put a
 * habit grid on the home screen of someone who has the feature switched off and
 * then spend a second reload taking it away, and the narrow `select` keeps a
 * calendar URL from re-rendering the root of the authenticated tree.
 */
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
