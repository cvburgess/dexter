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

// Routes query/mutation failures to Sentry without every call site reporting
// individually; components still get isError/error for UI handling.
const reportQueryError = (error: unknown) => {
  Sentry.captureException(error);
};

// Shared freshness window (DEX-36): bounds how stale a query can get when
// realtime misses an event. Device-backed hooks (calendars, AsyncStorage) override it.
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

  // focusManager defaults to the browser's visibilitychange event, absent on
  // native — tie it to AppState so foregrounding refetches stale queries.
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
