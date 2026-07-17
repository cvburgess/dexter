import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ReactNode } from "react";

import * as daysApi from "@/api/days";
import { usePreferences } from "@/hooks/usePreferences";

import { daysMutationKey, useDays } from "../useDays";

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
    // `retryDelay: 0` keeps the mutation's `retry: 3` instant under test (the
    // hook sets the count but leaves the delay to the client default).
    defaultOptions: {
      queries: { retry: false },
      mutations: { retryDelay: 0 },
    },
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
        // No stored prompts to seed (template is empty), so a first write sends
        // an empty array — never null — for the shared, legacy-read column.
        { prompts: [], notes: "hello", date: "2026-07-12" },
      ),
    );
  });

  it("seeds journal prompts from the template on a first write", async () => {
    mockUsePreferences.mockReturnValue([
      {
        templateNote: "# My template",
        templatePrompts: ["Highlight", "Grateful for"],
      } as never,
      { updatePreferences: jest.fn() },
    ]);
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

    // Inserting a brand-new day must carry the template prompts so the shared
    // legacy Journal renders them (and never `.map()`s over null).
    await waitFor(() =>
      expect(mockUpsertDay).toHaveBeenCalledWith(
        {},
        {
          prompts: [
            { prompt: "Highlight", response: "" },
            { prompt: "Grateful for", response: "" },
          ],
          notes: "hello",
          date: "2026-07-12",
        },
      ),
    );
  });

  it("does not resend prompts when updating a day that already has a row", async () => {
    mockGetDay.mockResolvedValue({
      date: "2026-07-12",
      notes: "existing",
      prompts: [{ prompt: "Highlight", response: "kept" }],
    });
    mockUpsertDay.mockResolvedValue({
      date: "2026-07-12",
      notes: "edited",
      prompts: [{ prompt: "Highlight", response: "kept" }],
    });

    const { result } = renderHook(() => useDays("2026-07-12"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current[1].exists).toBe(true));
    act(() => result.current[1].upsertDay({ notes: "edited" }));

    // An existing row keeps its stored prompts; the update must not overwrite
    // them, so the payload carries only the diff.
    await waitFor(() =>
      expect(mockUpsertDay).toHaveBeenCalledWith(
        {},
        { notes: "edited", date: "2026-07-12" },
      ),
    );
  });

  it("retries a failed note save and persists once it succeeds", async () => {
    mockGetDay.mockResolvedValue(null);
    mockUpsertDay
      .mockRejectedValueOnce(new Error("blip"))
      .mockResolvedValueOnce({
        date: "2026-07-12",
        notes: "typed",
        prompts: [],
      });

    const { result } = renderHook(() => useDays("2026-07-12"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current[1].isLoading).toBe(false));

    act(() => result.current[1].upsertDay({ notes: "typed" }));

    await waitFor(() => expect(mockUpsertDay).toHaveBeenCalledTimes(2));
    // The successful retry's response is written to the cache.
    await waitFor(() => expect(result.current[0].notes).toBe("typed"));
    expect(result.current[1].exists).toBe(true);
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

  it("tags the upsert with daysMutationKey while it is in flight", async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retryDelay: 0 },
      },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    mockGetDay.mockResolvedValue(null);
    let resolveUpsert: (day: daysApi.TDay) => void = () => {};
    mockUpsertDay.mockReturnValue(
      new Promise((resolve) => {
        resolveUpsert = resolve;
      }),
    );

    const { result } = renderHook(() => useDays("2026-07-12"), { wrapper });
    await waitFor(() => expect(result.current[1].isLoading).toBe(false));

    expect(client.isMutating({ mutationKey: daysMutationKey })).toBe(0);
    act(() => result.current[1].upsertDay({ notes: "hello" }));
    await waitFor(() =>
      expect(client.isMutating({ mutationKey: daysMutationKey })).toBe(1),
    );

    resolveUpsert({ date: "2026-07-12", notes: "hello", prompts: [] });
    await waitFor(() =>
      expect(client.isMutating({ mutationKey: daysMutationKey })).toBe(0),
    );
  });
});
