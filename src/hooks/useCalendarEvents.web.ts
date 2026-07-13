import { Temporal } from "@js-temporal/polyfill";
import { useQuery } from "@tanstack/react-query";

import { parseIcsEventsForDate } from "@/utils/icsEvents";

import { usePreferences } from "./usePreferences";
import { TCalendarEvent, TUseCalendarEvents } from "./useCalendarEvents.types";

const STALE_TIME_MS = 1000 * 60 * 10;

/** Route a third-party `.ics` URL through the ics-proxy Edge Function (CORS + SSRF guard). */
const proxyUrl = (icsUrl: string): string => {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  return `${base}/functions/v1/ics-proxy?url=${encodeURIComponent(icsUrl)}`;
};

/**
 * Fetch and parse every configured feed for the day. Feeds are independent: a
 * failed one is skipped so the rest still render; only an all-feeds failure
 * surfaces as an error.
 */
const fetchIcsEvents = async (
  urls: string[],
  dateIso: string,
): Promise<TCalendarEvent[]> => {
  const date = Temporal.PlainDate.from(dateIso);
  const timeZone = Temporal.Now.timeZoneId();

  const settled = await Promise.allSettled(
    urls.map(async (url) => {
      const response = await fetch(proxyUrl(url));
      if (!response.ok) {
        throw new Error(`ics-proxy returned ${response.status}`);
      }
      return parseIcsEventsForDate(await response.text(), date, timeZone);
    }),
  );

  const failed = settled.filter((r) => r.status === "rejected");
  if (urls.length > 0 && failed.length === urls.length) {
    throw new Error("All calendar feeds failed to load");
  }

  return settled
    .filter(
      (r): r is PromiseFulfilledResult<TCalendarEvent[]> =>
        r.status === "fulfilled",
    )
    .flatMap((r) => r.value);
};

/**
 * Web calendar source: proxied `.ics` feeds parsed into events for the viewed
 * day. Feed URLs come from `preferences.calendarUrls` (Supabase-synced).
 */
export const useCalendarEvents = (
  date: Temporal.PlainDate,
): TUseCalendarEvents => {
  const [preferences] = usePreferences();
  const urls = preferences.calendarUrls;
  const active = preferences.enableCalendar && urls.length > 0;

  const {
    data = [],
    isLoading,
    isError,
  } = useQuery({
    enabled: active,
    queryKey: ["calendarEvents", date.toString(), urls],
    queryFn: () => fetchIcsEvents(urls, date.toString()),
    staleTime: STALE_TIME_MS,
  });

  return [
    data,
    { isLoading: active && isLoading, isError, permissionDenied: false },
  ];
};
