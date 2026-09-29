import { Temporal } from "@js-temporal/polyfill";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";

import { parseIcsEventsForDate } from "@/utils/icsEvents";
import { supabaseUrl } from "@/utils/supabase";

import { useAuth } from "./useAuth";
import { usePreferences } from "./usePreferences";
import { TCalendarEvent, TUseCalendarEvents } from "./useCalendarEvents.types";

const STALE_TIME_MS = 1000 * 60 * 10;
const NO_EVENTS: TCalendarEvent[] = [];

/** Route a third-party `.ics` URL through the ics-proxy Edge Function (CORS + SSRF guard). */
const proxyUrl = (icsUrl: string): string => {
  // `supabaseUrl` is the validated base from utils/supabase (throws on a
  // missing env), rather than an unchecked `process.env` read here.
  return `${supabaseUrl}/functions/v1/ics-proxy?url=${encodeURIComponent(icsUrl)}`;
};

const fetchIcsFeed = async (url: string): Promise<string> => {
  const response = await fetch(proxyUrl(url));
  if (!response.ok) {
    throw new Error(`ics-proxy returned ${response.status}`);
  }
  return response.text();
};

// Module-level so React Query can keep the combined result's identity stable
// between renders, which the parse memo below depends on.
const combineFeeds = (results: UseQueryResult<string>[]) => ({
  feeds: results.flatMap((result) => (result.data ? [result.data] : [])),
  isLoading: results.some((result) => result.isLoading),
  // Feeds are independent: a failed one is skipped so the rest still render;
  // only an all-feeds failure surfaces as an error.
  isError: results.length > 0 && results.every((result) => result.isError),
});

// Web calendar source: proxied .ics feeds parsed into events for the viewed
// day. Feed URLs come from preferences.calendarUrls (Supabase-synced).
export const useCalendarEvents = (
  date: Temporal.PlainDate,
): TUseCalendarEvents => {
  const [preferences] = usePreferences();
  const { session } = useAuth();
  const userEmail = session?.user?.email;
  const urls = preferences.calendarUrls;
  const active = preferences.enableCalendar && urls.length > 0;

  // Keyed by feed, not by day (DEX-186): the Week tab's seven columns, Today
  // and the ritual all parse one cached download per feed.
  const { feeds, isLoading, isError } = useQueries({
    queries: urls.map((url) => ({
      enabled: active,
      queryKey: ["icsFeed", url],
      queryFn: () => fetchIcsFeed(url),
      staleTime: STALE_TIME_MS,
      // Refetch on every day-load to pick up feed changes; cached events still
      // show during the background refetch, so there's no empty flash.
      refetchOnMount: "always" as const,
    })),
    combine: combineFeeds,
  });

  const dateIso = date.toString();
  const events = useMemo(() => {
    const day = Temporal.PlainDate.from(dateIso);
    const timeZone = Temporal.Now.timeZoneId();
    return feeds.flatMap((feed) =>
      parseIcsEventsForDate(feed, day, timeZone, userEmail),
    );
  }, [feeds, dateIso, userEmail]);

  return [
    active ? events : NO_EVENTS,
    {
      isLoading: active && isLoading,
      isError: active && isError,
      permissionDenied: false,
      // Safe synchronously, unlike native: reaching here means enableCalendar
      // is true, so the preferences row has loaded and urls is the user's own.
      notConfigured: urls.length === 0,
    },
  ];
};
