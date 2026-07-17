import * as Sentry from "@sentry/react-native";
import {
  focusManager,
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactNode, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";

// Routes query/mutation failures to Sentry so data-layer errors are visible
// without every call site having to report them individually. Components
// still get the error via React Query's own state (isError/error) for UI
// handling — this only adds reporting.
const reportQueryError = (error: unknown) => {
  Sentry.captureException(error);
};

// Shared freshness window for Supabase-backed queries (DEX-36). Paired with
// the realtime invalidation layer (see useRealtimeInvalidation): realtime
// keeps the cache current while connected, and this staleTime bounds how far
// behind a query can be when realtime misses an event or was never
// connected. Device-backed queries (device calendars, AsyncStorage-backed
// preferences like todayPanes) override this per-hook since there's no
// cross-platform staleness to bound.
export const DEFAULT_STALE_TIME_MS = 1000 * 60;

export const QueryProvider = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: DEFAULT_STALE_TIME_MS },
        },
        queryCache: new QueryCache({ onError: reportQueryError }),
        mutationCache: new MutationCache({ onError: reportQueryError }),
      }),
  );

  // React Query's `refetchOnWindowFocus` relies on a `focusManager` event
  // source that defaults to the browser's `visibilitychange` event, which
  // doesn't exist on native. Tie it to `AppState` instead so foregrounding
  // the app refetches queries that went stale while backgrounded — the same
  // gap the auth-refresh AppState listener in utils/supabase.ts closes for
  // tokens. Web already gets this behavior for free, so skip attaching a
  // second listener there.
  useEffect(() => {
    if (Platform.OS === "web") return;

    const subscription = AppState.addEventListener("change", (state) => {
      focusManager.setFocused(state === "active");
    });

    return () => subscription.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};
