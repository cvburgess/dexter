import { act, fireEvent, render } from "@testing-library/react-native";

import { TJournalPrompt } from "@/api/days";
import { useDays } from "@/hooks/useDays";

import { JournalView } from "../JournalView";

jest.mock("@/hooks/useDays", () => ({ useDays: jest.fn() }));

const mockUseDays = useDays as jest.MockedFunction<typeof useDays>;
const mockUpsertDay = jest.fn();
const mockUpsertDayAsync = jest.fn().mockResolvedValue(undefined);

const setup = ({
  prompts = [],
  isLoading = false,
}: {
  prompts?: TJournalPrompt[];
  isLoading?: boolean;
} = {}) => {
  mockUseDays.mockReturnValue([
    { date: "2026-07-12", notes: "", prompts },
    {
      isLoading,
      exists: prompts.length > 0,
      upsertDay: mockUpsertDay,
      upsertDayAsync: mockUpsertDayAsync,
    },
  ]);
  return render(<JournalView date="2026-07-12" />);
};

describe("JournalView", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders one input per prompt, labelled with the prompt", () => {
    const screen = setup({
      prompts: [
        { prompt: "Highlight", response: "" },
        { prompt: "Grateful for", response: "" },
      ],
    });

    expect(screen.getByText("Highlight")).toBeTruthy();
    expect(screen.getByText("Grateful for")).toBeTruthy();
    expect(screen.getByTestId("journal-response-0")).toBeTruthy();
    expect(screen.getByTestId("journal-response-1")).toBeTruthy();
  });

  it("autosaves a debounced upsert, replacing the edited entry by index", () => {
    jest.useFakeTimers();
    try {
      const screen = setup({
        prompts: [
          { prompt: "Highlight", response: "" },
          { prompt: "Grateful for", response: "family" },
        ],
      });

      fireEvent.changeText(
        screen.getByTestId("journal-response-0"),
        "Shipped the feature",
      );
      expect(mockUpsertDayAsync).not.toHaveBeenCalled();

      act(() => jest.advanceTimersByTime(800));

      // The edited entry is replaced; the other response is left intact.
      expect(mockUpsertDayAsync).toHaveBeenCalledWith({
        prompts: [
          { prompt: "Highlight", response: "Shipped the feature" },
          { prompt: "Grateful for", response: "family" },
        ],
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it("shows no inputs or empty state while the day loads", () => {
    const screen = setup({ isLoading: true });

    expect(screen.queryByTestId("journal-response-0")).toBeNull();
    expect(
      screen.queryByText("Add journal prompts in Settings → Journal"),
    ).toBeNull();
  });

  it("shows an empty state when no prompts are configured", () => {
    const screen = setup({ prompts: [] });

    expect(
      screen.getByText("Add journal prompts in Settings → Journal"),
    ).toBeTruthy();
    expect(screen.queryByTestId("journal-response-0")).toBeNull();
  });

  it("flushes a pending edit immediately on unmount", () => {
    jest.useFakeTimers();
    try {
      const screen = setup({
        prompts: [{ prompt: "Highlight", response: "" }],
      });

      fireEvent.changeText(
        screen.getByTestId("journal-response-0"),
        "Half-written",
      );
      // Unmount before the debounce elapses (e.g. tab switch / date change).
      act(() => screen.unmount());

      expect(mockUpsertDayAsync).toHaveBeenCalledWith({
        prompts: [{ prompt: "Highlight", response: "Half-written" }],
      });
    } finally {
      jest.useRealTimers();
    }
  });
});
