import { act, renderHook, waitFor } from "@testing-library/react-native";
import {
  focusManager,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { PostgrestError } from "@supabase/supabase-js";
import { AppState } from "react-native";

import { DEFAULT_STALE_TIME_MS, QueryProvider } from "../QueryProvider";

const mockCaptureException = jest.fn();

jest.mock("@sentry/react-native", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

describe("QueryProvider error routing", () => {
  afterEach(() => {
    mockCaptureException.mockClear();
  });

  it("reports failed queries to Sentry", async () => {
    const error = new Error("query failed");

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ["sentry-test-query"],
          queryFn: () => Promise.reject(error),
          retry: false,
        }),
      { wrapper: QueryProvider },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockCaptureException).toHaveBeenCalledWith(error, {
      extra: { key: ["sentry-test-query"] },
    });
  });

  it("reports plain-object Supabase errors as PostgrestError", async () => {
    const supabaseError = {
      code: "23505",
      details: null,
      hint: null,
      message: 'duplicate key value violates unique constraint "pkey"',
    };

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ["sentry-postgrest-query"],
          // A plain-object rejection is exactly what supabase-js produces.
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          queryFn: () => Promise.reject(supabaseError),
          retry: false,
        }),
      { wrapper: QueryProvider },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    const [captured, hint] = mockCaptureException.mock.calls[0];
    expect(captured).toBeInstanceOf(PostgrestError);
    expect(captured.message).toBe(supabaseError.message);
    expect(hint).toEqual({
      fingerprint: ["postgrest", "23505", supabaseError.message],
      contexts: { postgrest: { code: "23505", details: null, hint: null } },
      extra: { key: ["sentry-postgrest-query"] },
    });
  });

  it("reports failed mutations to Sentry", async () => {
    const error = new Error("mutation failed");

    const { result } = renderHook(
      () =>
        useMutation({
          mutationKey: ["sentry-test-mutation"],
          mutationFn: () => Promise.reject(error),
          retry: false,
        }),
      { wrapper: QueryProvider },
    );

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow(
        "mutation failed",
      );
    });

    expect(mockCaptureException).toHaveBeenCalledWith(error, {
      extra: { key: ["sentry-test-mutation"] },
    });
  });
});

describe("QueryProvider freshness defaults", () => {
  it("gives Supabase-backed queries a shared default staleTime", () => {
    const { result } = renderHook(() => useQueryClient(), {
      wrapper: QueryProvider,
    });

    expect(result.current.getDefaultOptions().queries?.staleTime).toBe(
      DEFAULT_STALE_TIME_MS,
    );
  });

  it("ties focusManager to AppState so foregrounding refetches stale queries", () => {
    const addEventListenerSpy = jest.spyOn(AppState, "addEventListener");

    renderHook(() => null, { wrapper: QueryProvider });

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
    const handleChange = addEventListenerSpy.mock.calls[0][1];

    act(() => handleChange("background"));
    expect(focusManager.isFocused()).toBe(false);

    act(() => handleChange("active"));
    expect(focusManager.isFocused()).toBe(true);

    addEventListenerSpy.mockRestore();
    // Module-level singleton — restore React Query's own event source so
    // this test doesn't leak a stuck focus state into other test files.
    focusManager.setFocused(undefined);
  });
});
