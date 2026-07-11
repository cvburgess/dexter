import * as Sentry from "@sentry/react-native";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactNode, useState } from "react";

// Routes query/mutation failures to Sentry so data-layer errors are visible
// without every call site having to report them individually. Components
// still get the error via React Query's own state (isError/error) for UI
// handling — this only adds reporting.
const reportQueryError = (error: unknown) => {
  Sentry.captureException(error);
};

export const QueryProvider = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: reportQueryError }),
        mutationCache: new MutationCache({ onError: reportQueryError }),
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};
