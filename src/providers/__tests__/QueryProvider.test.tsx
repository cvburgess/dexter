import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useMutation, useQuery } from "@tanstack/react-query";

import { QueryProvider } from "../QueryProvider";

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
