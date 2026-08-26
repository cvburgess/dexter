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

// Takes the stored shape: a flat list where each prompt names its own ritual.
const setTemplatePrompts = (
  templatePrompts: { id: string; prompt: string; period: "am" | "pm" }[],
) =>
  mockUsePreferences.mockReturnValue([
    { templatePrompts } as never,
    { updatePreferences: jest.fn() },
  ]);

const amPrompt = (prompt: string) =>
  ({ id: prompt, prompt, period: "am" }) as const;

describe("useJournals", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setTemplatePrompts([]);
  });

  it("seeds a day with no row from the prompt template", async () => {
    setTemplatePrompts([amPrompt("Highlight"), amPrompt("Grateful for")]);
    mockGetJournal.mockResolvedValue(null);

    const { result } = renderHook(() => useJournals("2026-07-12"), {
      wrapper: createWrapper().wrapper,
    });

    await waitFor(() => expect(result.current[1].isLoading).toBe(false));
    // Unlike notes, prompts auto-seed so a blank day is immediately answerable;
    // nothing is persisted until the user types.
    expect(result.current[0].prompts).toEqual([
      { prompt: "Highlight", response: "", period: "am" },
      { prompt: "Grateful for", response: "", period: "am" },
    ]);
    expect(result.current[1].exists).toBe(false);
  });

  // The whole day, not the ritual opened first: a one-period seed would let the
  // evening's first save write a row the morning was missing from.
  it("seeds every ritual's prompts, in order, each stamped with its period", async () => {
    setTemplatePrompts([
      amPrompt("Highlight"),
      { id: "pm", prompt: "What went well?", period: "pm" },
    ]);
    mockGetJournal.mockResolvedValue(null);

    const { result } = renderHook(() => useJournals("2026-07-12"), {
      wrapper: createWrapper().wrapper,
    });

    await waitFor(() => expect(result.current[1].isLoading).toBe(false));
    expect(result.current[0].prompts).toEqual([
      { prompt: "Highlight", response: "", period: "am" },
      { prompt: "What went well?", response: "", period: "pm" },
    ]);
  });

  it("reports exists=true and the stored prompts when a row is present", async () => {
    setTemplatePrompts([amPrompt("Highlight")]);
    mockGetJournal.mockResolvedValue({
      date: "2026-07-12",
      prompts: [{ prompt: "Highlight", response: "kept" }],
      mood: null,
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

  // `journals.prompts` defaults to `[]`, and the template only fills in while
  // the day has no row — so a mood that inserted the row alone would strand the
  // day on an empty journal it never got seeded with.
  describe("mood (DEX-191)", () => {
    it("carries the seeded prompts when a mood creates the day's row", async () => {
      setTemplatePrompts([amPrompt("Highlight")]);
      mockGetJournal.mockResolvedValue(null);
      mockUpsertJournal.mockResolvedValue({
        date: "2026-07-12",
        prompts: [{ prompt: "Highlight", response: "", period: "am" }],
        mood: 4,
      });

      const { result } = renderHook(() => useJournals("2026-07-12"), {
        wrapper: createWrapper().wrapper,
      });
      await waitFor(() => expect(result.current[1].isLoading).toBe(false));

      act(() => result.current[1].upsertJournal({ mood: 4 }));

      await waitFor(() =>
        expect(mockUpsertJournal).toHaveBeenCalledWith(expect.anything(), {
          date: "2026-07-12",
          mood: 4,
          prompts: [{ prompt: "Highlight", response: "", period: "am" }],
        }),
      );
    });

    it("leaves the stored prompts alone once the day has a row", async () => {
      setTemplatePrompts([amPrompt("Highlight")]);
      mockGetJournal.mockResolvedValue({
        date: "2026-07-12",
        prompts: [{ prompt: "Highlight", response: "kept" }],
        mood: null,
      });
      mockUpsertJournal.mockResolvedValue({
        date: "2026-07-12",
        prompts: [{ prompt: "Highlight", response: "kept" }],
        mood: 2,
      });

      const { result } = renderHook(() => useJournals("2026-07-12"), {
        wrapper: createWrapper().wrapper,
      });
      await waitFor(() => expect(result.current[1].exists).toBe(true));

      act(() => result.current[1].upsertJournal({ mood: 2 }));

      await waitFor(() =>
        expect(mockUpsertJournal).toHaveBeenCalledWith(expect.anything(), {
          date: "2026-07-12",
          mood: 2,
        }),
      );
    });

    it("defaults an unwritten day's mood to null", async () => {
      mockGetJournal.mockResolvedValue(null);

      const { result } = renderHook(() => useJournals("2026-07-12"), {
        wrapper: createWrapper().wrapper,
      });

      await waitFor(() => expect(result.current[1].isLoading).toBe(false));
      expect(result.current[0].mood).toBeNull();
    });
  });

  it("upserts the diff together with the day's date", async () => {
    mockGetJournal.mockResolvedValue(null);
    const prompts = [{ prompt: "Highlight", response: "shipped it" }];
    mockUpsertJournal.mockResolvedValue({
      date: "2026-07-12",
      prompts,
      mood: null,
    });

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
      .mockResolvedValueOnce({ date: "2026-07-12", prompts, mood: null });

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
    setTemplatePrompts([amPrompt("Highlight")]);
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
        { prompt: "Highlight", response: "", period: "am" },
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

    resolveUpsert({ date: "2026-07-12", prompts: [], mood: null });
    await waitFor(() =>
      expect(
        client.isMutating({ mutationKey: journalsMutationKey("2026-07-12") }),
      ).toBe(0),
    );
  });
});
