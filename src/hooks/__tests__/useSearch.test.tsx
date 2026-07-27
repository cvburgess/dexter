import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import { ReactNode } from "react";

import { searchEntries, TSearchResult } from "@/api/search";
import { MIN_SEARCH_LENGTH, useSearch } from "@/hooks/useSearch";

jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/api/search", () => ({ searchEntries: jest.fn() }));

const mockSearchEntries = searchEntries as jest.MockedFunction<
  typeof searchEntries
>;

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
};

const noteResult = (content: string): TSearchResult => ({
  kind: "note",
  date: "2026-07-13",
  content,
});

describe("useSearch", () => {
  beforeEach(() => {
    mockSearchEntries.mockReset();
    mockSearchEntries.mockResolvedValue([noteResult("bought the milk")]);
  });

  it("returns results once the query resolves", async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useSearch("milk"), { wrapper });

    await waitFor(() => expect(result.current[1].isLoading).toBe(false));
    expect(result.current[0]).toEqual([noteResult("bought the milk")]);
    expect(mockSearchEntries).toHaveBeenCalledWith({}, "milk");
  });

  it("does not search a query below the minimum length", async () => {
    const { wrapper } = createWrapper();
    const short = "x".repeat(MIN_SEARCH_LENGTH - 1);

    const { result } = renderHook(() => useSearch(short), { wrapper });

    expect(result.current[1].enabled).toBe(false);
    // No round trip, and no spinner either — the screen shows its prompt state
    // rather than a loading state for a query it never ran.
    expect(result.current[1].isLoading).toBe(false);
    expect(result.current[0]).toEqual([]);
    expect(mockSearchEntries).not.toHaveBeenCalled();
  });

  it("ignores surrounding whitespace when deciding to search", async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useSearch("   m   "), { wrapper });

    // One character of real input, so still below the floor.
    expect(result.current[1].enabled).toBe(false);
    expect(mockSearchEntries).not.toHaveBeenCalled();
  });

  it("searches the trimmed query, so padded variants share a cache entry", async () => {
    const { wrapper } = createWrapper();

    const { result, rerender } = renderHook(({ query }) => useSearch(query), {
      wrapper,
      initialProps: { query: "milk" },
    });
    await waitFor(() => expect(result.current[0]).toHaveLength(1));

    rerender({ query: "  milk  " });
    await waitFor(() => expect(result.current[0]).toHaveLength(1));

    expect(mockSearchEntries).toHaveBeenCalledTimes(1);
    expect(mockSearchEntries).toHaveBeenCalledWith({}, "milk");
  });

  it("keeps results empty when the query fails", async () => {
    mockSearchEntries.mockRejectedValue(new Error("boom"));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useSearch("milk"), { wrapper });

    await waitFor(() => expect(result.current[1].isLoading).toBe(false));
    expect(result.current[0]).toEqual([]);
  });
});
