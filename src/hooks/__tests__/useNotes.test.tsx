import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ReactNode } from "react";

import * as notesApi from "@/api/notes";

import { notesMutationKey, useNotes } from "../useNotes";

jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/api/notes", () => ({ getNote: jest.fn(), upsertNote: jest.fn() }));

const mockGetNote = notesApi.getNote as jest.MockedFunction<
  typeof notesApi.getNote
>;
const mockUpsertNote = notesApi.upsertNote as jest.MockedFunction<
  typeof notesApi.upsertNote
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

describe("useNotes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("defaults a day with no row to a blank note", async () => {
    mockGetNote.mockResolvedValue(null);

    const { result } = renderHook(() => useNotes("2026-07-12"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current[1].isLoading).toBe(false));
    // The daily-note template must NOT be auto-applied — NotesView offers the
    // "Use template" / "Blank note" choice off `exists`.
    expect(result.current[0].content).toBe("");
    expect(result.current[1].exists).toBe(false);
  });

  it("reports exists=true and the stored note when a row is present", async () => {
    mockGetNote.mockResolvedValue({ date: "2026-07-12", content: "existing" });

    const { result } = renderHook(() => useNotes("2026-07-12"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current[1].exists).toBe(true));
    expect(result.current[0].content).toBe("existing");
  });

  it("upserts the diff together with the day's date", async () => {
    mockGetNote.mockResolvedValue(null);
    mockUpsertNote.mockResolvedValue({ date: "2026-07-12", content: "hello" });

    const { result } = renderHook(() => useNotes("2026-07-12"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current[1].isLoading).toBe(false));
    act(() => result.current[1].upsertNote({ content: "hello" }));

    // Only the note's own column travels now — nothing has to be re-sent to
    // protect a sibling journal column (DEX-51).
    await waitFor(() =>
      expect(mockUpsertNote).toHaveBeenCalledWith(
        {},
        { content: "hello", date: "2026-07-12" },
      ),
    );
  });

  it("retries a failed note save and persists once it succeeds", async () => {
    mockGetNote.mockResolvedValue(null);
    mockUpsertNote
      .mockRejectedValueOnce(new Error("blip"))
      .mockResolvedValueOnce({ date: "2026-07-12", content: "typed" });

    const { result } = renderHook(() => useNotes("2026-07-12"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current[1].isLoading).toBe(false));

    act(() => result.current[1].upsertNote({ content: "typed" }));

    await waitFor(() => expect(mockUpsertNote).toHaveBeenCalledTimes(2));
    // The successful retry's response is written to the cache.
    await waitFor(() => expect(result.current[0].content).toBe("typed"));
    expect(result.current[1].exists).toBe(true);
  });

  it("rolls back the optimistic note when the first save fails for a new day", async () => {
    mockGetNote.mockResolvedValue(null);
    mockUpsertNote.mockRejectedValue(new Error("save failed"));

    const { result } = renderHook(() => useNotes("2026-07-12"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current[1].isLoading).toBe(false));

    act(() => result.current[1].upsertNote({ content: "typed" }));
    await waitFor(() => expect(mockUpsertNote).toHaveBeenCalled());

    // The failed save must not leave the never-persisted note in the cache.
    await waitFor(() => expect(result.current[0].content).toBe(""));
    expect(result.current[1].exists).toBe(false);
  });

  it("tags the upsert with notesMutationKey while it is in flight", async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retryDelay: 0 },
      },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    mockGetNote.mockResolvedValue(null);
    let resolveUpsert: (note: notesApi.TNote) => void = () => {};
    mockUpsertNote.mockReturnValue(
      new Promise((resolve) => {
        resolveUpsert = resolve;
      }),
    );

    const { result } = renderHook(() => useNotes("2026-07-12"), { wrapper });
    await waitFor(() => expect(result.current[1].isLoading).toBe(false));

    expect(
      client.isMutating({ mutationKey: notesMutationKey("2026-07-12") }),
    ).toBe(0);
    act(() => result.current[1].upsertNote({ content: "hello" }));
    await waitFor(() =>
      expect(
        client.isMutating({ mutationKey: notesMutationKey("2026-07-12") }),
      ).toBe(1),
    );

    resolveUpsert({ date: "2026-07-12", content: "hello" });
    await waitFor(() =>
      expect(
        client.isMutating({ mutationKey: notesMutationKey("2026-07-12") }),
      ).toBe(0),
    );
  });
});
