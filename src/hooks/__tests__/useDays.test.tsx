import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ReactNode } from "react";

import * as daysApi from "@/api/days";
import { usePreferences } from "@/hooks/usePreferences";

import { useDays } from "../useDays";

jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));
jest.mock("@/api/days", () => ({ getDay: jest.fn(), upsertDay: jest.fn() }));

const mockGetDay = daysApi.getDay as jest.MockedFunction<typeof daysApi.getDay>;
const mockUpsertDay = daysApi.upsertDay as jest.MockedFunction<
  typeof daysApi.upsertDay
>;
const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe("useDays", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // A configured template must NOT be auto-applied to the note default.
    mockUsePreferences.mockReturnValue([
      { templateNote: "# My template", templatePrompts: [] } as never,
      { updatePreferences: jest.fn() },
    ]);
  });

  it("defaults a day with no row to a blank note, ignoring the template", async () => {
    mockGetDay.mockResolvedValue(null);

    const { result } = renderHook(() => useDays("2026-07-12"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current[1].isLoading).toBe(false));
    expect(result.current[0].notes).toBe("");
    expect(result.current[1].exists).toBe(false);
  });

  it("reports exists=true and the stored note when a row is present", async () => {
    mockGetDay.mockResolvedValue({
      date: "2026-07-12",
      notes: "existing",
      prompts: [],
    });

    const { result } = renderHook(() => useDays("2026-07-12"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current[1].exists).toBe(true));
    expect(result.current[0].notes).toBe("existing");
  });

  it("upserts the diff together with the day's date", async () => {
    mockGetDay.mockResolvedValue(null);
    mockUpsertDay.mockResolvedValue({
      date: "2026-07-12",
      notes: "hello",
      prompts: [],
    });

    const { result } = renderHook(() => useDays("2026-07-12"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current[1].isLoading).toBe(false));
    act(() => result.current[1].upsertDay({ notes: "hello" }));

    await waitFor(() =>
      expect(mockUpsertDay).toHaveBeenCalledWith(
        {},
        { notes: "hello", date: "2026-07-12" },
      ),
    );
  });

  it("rolls back the optimistic note when the first save fails for a new day", async () => {
    mockGetDay.mockResolvedValue(null);
    mockUpsertDay.mockRejectedValue(new Error("save failed"));

    const { result } = renderHook(() => useDays("2026-07-12"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current[1].isLoading).toBe(false));

    act(() => result.current[1].upsertDay({ notes: "typed" }));
    await waitFor(() => expect(mockUpsertDay).toHaveBeenCalled());

    // The failed save must not leave the never-persisted note in the cache.
    await waitFor(() => expect(result.current[0].notes).toBe(""));
    expect(result.current[1].exists).toBe(false);
  });
});
