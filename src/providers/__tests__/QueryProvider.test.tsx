import { act, renderHook, waitFor } from "@testing-library/react-native";
import {
  focusManager,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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

    expect(mockCaptureException).toHaveBeenCalledWith(error);
  });

  it("reports failed mutations to Sentry", async () => {
    const error = new Error("mutation failed");

    const { result } = renderHook(
      () =>
        useMutation({
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

    expect(mockCaptureException).toHaveBeenCalledWith(error);
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
