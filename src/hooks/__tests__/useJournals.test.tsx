import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ReactNode } from "react";

import * as journalsApi from "@/api/journals";
import { usePreferences } from "@/hooks/usePreferences";

import { journalsMutationKey, useJournals } from "../useJournals";

jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));
jest.mock("@/api/journals", () => ({
  getJournal: jest.fn(),
  upsertJournal: jest.fn(),
}));

const mockGetJournal = journalsApi.getJournal as jest.MockedFunction<
  typeof journalsApi.getJournal
>;
const mockUpsertJournal = journalsApi.upsertJournal as jest.MockedFunction<
  typeof journalsApi.upsertJournal
>;
const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;

// Returns the client alongside the wrapper so a test can inspect the mutation
// cache without standing up a second QueryClient of its own.
const createWrapper = () => {
  const client = new QueryClient({
    // `retryDelay: 0` keeps the mutation's `retry: 3` instant under test (the
    // hook sets the count but leaves the delay to the client default).
    defaultOptions: {
      queries: { retry: false },
      mutations: { retryDelay: 0 },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
};

const setTemplatePrompts = (templatePrompts: string[]) =>
  mockUsePreferences.mockReturnValue([
    { templatePrompts } as never,
    { updatePreferences: jest.fn() },
  ]);

describe("useJournals", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setTemplatePrompts([]);
  });

  it("seeds a day with no row from the prompt template", async () => {
    setTemplatePrompts(["Highlight", "Grateful for"]);
    mockGetJournal.mockResolvedValue(null);

    const { result } = renderHook(() => useJournals("2026-07-12"), {
      wrapper: createWrapper().wrapper,
    });

    await waitFor(() => expect(result.current[1].isLoading).toBe(false));
    // Unlike notes, prompts auto-seed so a blank day is immediately answerable;
    // nothing is persisted until the user types.
    expect(result.current[0].prompts).toEqual([
      { prompt: "Highlight", response: "" },
      { prompt: "Grateful for", response: "" },
    ]);
    expect(result.current[1].exists).toBe(false);
  });

  it("reports exists=true and the stored prompts when a row is present", async () => {
    setTemplatePrompts(["Highlight"]);
    mockGetJournal.mockResolvedValue({
      date: "2026-07-12",
      prompts: [{ prompt: "Highlight", response: "kept" }],
    });

    const { result } = renderHook(() => useJournals("2026-07-12"), {
      wrapper: createWrapper().wrapper,
    });

    await waitFor(() => expect(result.current[1].exists).toBe(true));
    // A stored row wins over the template — a renamed template prompt must not
    // silently rewrite an answered day.
    expect(result.current[0].prompts).toEqual([
      { prompt: "Highlight", response: "kept" },
    ]);
  });

  it("upserts the diff together with the day's date", async () => {
    mockGetJournal.mockResolvedValue(null);
    const prompts = [{ prompt: "Highlight", response: "shipped it" }];
    mockUpsertJournal.mockResolvedValue({ date: "2026-07-12", prompts });

    const { result } = renderHook(() => useJournals("2026-07-12"), {
      wrapper: createWrapper().wrapper,
    });

    await waitFor(() => expect(result.current[1].isLoading).toBe(false));
    act(() => result.current[1].upsertJournal({ prompts }));

    // Only the journal's own column travels now — the note no longer has to be
    // re-sent to survive the write (DEX-51).
    await waitFor(() =>
      expect(mockUpsertJournal).toHaveBeenCalledWith(
        {},
        { prompts, date: "2026-07-12" },
      ),
    );
  });

  it("retries a failed save and persists once it succeeds", async () => {
    mockGetJournal.mockResolvedValue(null);
    const prompts = [{ prompt: "Highlight", response: "typed" }];
    mockUpsertJournal
      .mockRejectedValueOnce(new Error("blip"))
      .mockResolvedValueOnce({ date: "2026-07-12", prompts });

    const { result } = renderHook(() => useJournals("2026-07-12"), {
      wrapper: createWrapper().wrapper,
    });
    await waitFor(() => expect(result.current[1].isLoading).toBe(false));

    act(() => result.current[1].upsertJournal({ prompts }));

    await waitFor(() => expect(mockUpsertJournal).toHaveBeenCalledTimes(2));
    // The successful retry's response is written to the cache.
    await waitFor(() => expect(result.current[0].prompts).toEqual(prompts));
    expect(result.current[1].exists).toBe(true);
  });

  it("rolls back the optimistic responses when the first save fails", async () => {
    setTemplatePrompts(["Highlight"]);
    mockGetJournal.mockResolvedValue(null);
    mockUpsertJournal.mockRejectedValue(new Error("save failed"));

    const { result } = renderHook(() => useJournals("2026-07-12"), {
      wrapper: createWrapper().wrapper,
    });
    await waitFor(() => expect(result.current[1].isLoading).toBe(false));

    act(() =>
      result.current[1].upsertJournal({
        prompts: [{ prompt: "Highlight", response: "typed" }],
      }),
    );
    await waitFor(() => expect(mockUpsertJournal).toHaveBeenCalled());

    // The failed save must not leave never-persisted responses in the cache —
    // it falls back to the template-seeded default.
    await waitFor(() =>
      expect(result.current[0].prompts).toEqual([
        { prompt: "Highlight", response: "" },
      ]),
    );
    expect(result.current[1].exists).toBe(false);
  });

  it("tags the upsert with journalsMutationKey while it is in flight", async () => {
    const { client, wrapper } = createWrapper();

    mockGetJournal.mockResolvedValue(null);
    let resolveUpsert: (journal: journalsApi.TJournal) => void = () => {};
    mockUpsertJournal.mockReturnValue(
      new Promise((resolve) => {
        resolveUpsert = resolve;
      }),
    );

    const { result } = renderHook(() => useJournals("2026-07-12"), { wrapper });
    await waitFor(() => expect(result.current[1].isLoading).toBe(false));

    expect(
      client.isMutating({ mutationKey: journalsMutationKey("2026-07-12") }),
    ).toBe(0);
    act(() => result.current[1].upsertJournal({ prompts: [] }));
    await waitFor(() =>
      expect(
        client.isMutating({ mutationKey: journalsMutationKey("2026-07-12") }),
      ).toBe(1),
    );

    resolveUpsert({ date: "2026-07-12", prompts: [] });
    await waitFor(() =>
      expect(
        client.isMutating({ mutationKey: journalsMutationKey("2026-07-12") }),
      ).toBe(0),
    );
  });
});
