import * as Sentry from "@sentry/react-native";
import { PostgrestError } from "@supabase/supabase-js";
import {
  focusManager,
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactNode, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";

type TPostgrestErrorFields = ConstructorParameters<typeof PostgrestError>[0];

const isPostgrestErrorObject = (
  error: unknown,
): error is TPostgrestErrorFields =>
  !(error instanceof Error) &&
  typeof error === "object" &&
  error !== null &&
  typeof (error as { message?: unknown }).message === "string";

// Routes query/mutation failures to Sentry without every call site reporting
// individually. supabase-js returns errors as plain objects, which Sentry
// can't title or group — wrap them in the library's own Error subclass.
const reportQueryError = (error: unknown, key: readonly unknown[] = []) => {
  if (isPostgrestErrorObject(error)) {
    const { code, details, hint, message } = error;
    // The synthesized stack is identical for every Supabase failure, so
    // Sentry's default stack grouping would merge them all into one issue.
    Sentry.captureException(new PostgrestError(error), {
      fingerprint: ["postgrest", code ?? "", message],
      contexts: { postgrest: { code, details, hint } },
      extra: { key },
    });
    return;
  }

  Sentry.captureException(error, { extra: { key } });
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
        queryCache: new QueryCache({
          onError: (error, query) => reportQueryError(error, query.queryKey),
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) =>
            reportQueryError(error, mutation.options.mutationKey),
        }),
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
