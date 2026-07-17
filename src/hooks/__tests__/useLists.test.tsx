import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ReactNode } from "react";

import { createList, getLists, TList } from "@/api/lists";

import { listsQueryOptions, useLists } from "../useLists";

// useLists imports the supabase client from useAuth, which reads the app's
// URI scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/api/lists", () => ({
  ...jest.requireActual<typeof import("@/api/lists")>("@/api/lists"),
  getLists: jest.fn(),
  createList: jest.fn(),
}));

const mockGetLists = getLists as jest.MockedFunction<typeof getLists>;
const mockCreateList = createList as jest.MockedFunction<typeof createList>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
};

const makeList = (overrides: Partial<TList> = {}): TList => ({
  id: "list-1",
  title: "Work",
  emoji: "💼",
  isArchived: false,
  createdAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("useLists", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLists.mockResolvedValue([]);
  });

  it("exposes a stable lists query key", () => {
    expect(listsQueryOptions.queryKey).toEqual(["lists"]);
  });

  it("fetches under a single stable query key, not one per caller", async () => {
    const { wrapper, queryClient } = createWrapper();

    renderHook(() => useLists(), { wrapper });
    renderHook(() => useLists(), { wrapper });

    await waitFor(() => expect(mockGetLists).toHaveBeenCalledTimes(1));
    expect(
      queryClient.getQueryCache().findAll({ queryKey: ["lists"] }),
    ).toHaveLength(1);
  });

  it("getListById returns the matching list, or undefined when missing/null", async () => {
    const { wrapper } = createWrapper();
    mockGetLists.mockResolvedValue([makeList()]);

    const { result } = renderHook(() => useLists(), { wrapper });
    await waitFor(() => expect(result.current[0]).toHaveLength(1));

    expect(result.current[1].getListById("list-1")?.title).toBe("Work");
    expect(result.current[1].getListById("nope")).toBeUndefined();
    expect(result.current[1].getListById(null)).toBeUndefined();
  });

  it("refetches the lists query after a create mutation", async () => {
    const { wrapper } = createWrapper();
    mockCreateList.mockResolvedValue([makeList()]);

    const { result } = renderHook(() => useLists(), { wrapper });
    await waitFor(() => expect(mockGetLists).toHaveBeenCalledTimes(1));

    act(() => result.current[1].createList({ title: "Work", emoji: "💼" }));

    await waitFor(() => expect(mockGetLists).toHaveBeenCalledTimes(2));
  });
});
