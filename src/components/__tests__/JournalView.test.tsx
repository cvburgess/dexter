import { act, fireEvent, render } from "@testing-library/react-native";
import type { ReactTestInstance } from "react-test-renderer";
import { ScrollView, StyleSheet, type ViewStyle } from "react-native";

import { TJournalPrompt } from "@/api/journals";
import { useJournals } from "@/hooks/useJournals";
import type { TRitualMode } from "@/utils/ritualSteps";

import { JournalView } from "../JournalView";

jest.mock("@/hooks/useJournals", () => ({ useJournals: jest.fn() }));

const mockUseJournals = useJournals as jest.MockedFunction<typeof useJournals>;
const mockUpsertJournal = jest.fn();
const mockUpsertJournalAsync = jest.fn().mockResolvedValue(undefined);

// `mode` and a missing `period` both default to morning, so a case that says
// nothing about periods exercises exactly what it did before DEX-151.
const setup = ({
  prompts = [],
  isLoading = false,
  mode = "am",
  mood = null,
  exists,
  onEditingChange,
}: {
  prompts?: TJournalPrompt[];
  isLoading?: boolean;
  mode?: TRitualMode;
  mood?: number | null;
  exists?: boolean;
  onEditingChange?: (editing: boolean) => void;
} = {}) => {
  mockUseJournals.mockReturnValue([
    { date: "2026-07-12", prompts, mood },
    {
      isLoading,
      exists: exists ?? prompts.length > 0,
      upsertJournal: mockUpsertJournal,
      upsertJournalAsync: mockUpsertJournalAsync,
    },
  ]);
  return render(
    <JournalView
      date="2026-07-12"
      mode={mode}
      onEditingChange={onEditingChange}
    />,
  );
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

  // Without this a focused field low on screen stays under the keyboard —
  // the wrapper it replaced padded the frame but never moved content (DEX-92).
  it("lets iOS inset the scroll content by the keyboard", () => {
    const screen = setup({
      prompts: [{ prompt: "How was today?", response: "" }],
    });

    expect(
      screen.UNSAFE_getByType(ScrollView).props
        .automaticallyAdjustKeyboardInsets,
    ).toBe(true);
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
      expect(mockUpsertJournalAsync).not.toHaveBeenCalled();

      act(() => jest.advanceTimersByTime(800));

      // The edited entry is replaced; the other response is left intact.
      expect(mockUpsertJournalAsync).toHaveBeenCalledWith({
        prompts: [
          { prompt: "Highlight", response: "Shipped the feature" },
          { prompt: "Grateful for", response: "family" },
        ],
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it("shows the loading screen (no inputs) even when prompts exist", () => {
    // Non-empty prompts + isLoading proves the loading branch suppresses the
    // inputs — distinct from the empty-prompts branch, which also renders none.
    const screen = setup({
      prompts: [{ prompt: "Highlight", response: "" }],
      isLoading: true,
    });

    expect(screen.queryByTestId("journal-response-0")).toBeNull();
    expect(
      screen.queryByText("Add a morning prompt in Settings → Ritual"),
    ).toBeNull();
  });

  it("seeds each input from its existing response", () => {
    const screen = setup({
      prompts: [{ prompt: "Grateful for", response: "family" }],
    });

    expect(screen.getByDisplayValue("family")).toBeTruthy();
  });

  it("signals editing on focus/blur and resets it on unmount", () => {
    const onEditingChange = jest.fn();
    const screen = setup({
      prompts: [{ prompt: "Highlight", response: "" }],
      onEditingChange,
    });

    const input = screen.getByTestId("journal-response-0");
    fireEvent(input, "focus");
    expect(onEditingChange).toHaveBeenLastCalledWith(true);

    fireEvent(input, "blur");
    expect(onEditingChange).toHaveBeenLastCalledWith(false);

    // Changing date / switching tabs unmounts a possibly-focused field without a
    // reliable blur; the unmount reset must clear the host's swipe-suspend flag.
    onEditingChange.mockClear();
    act(() => screen.unmount());
    expect(onEditingChange).toHaveBeenCalledWith(false);
  });

  it("shows an empty state when no prompts are configured", () => {
    const screen = setup({ prompts: [] });

    expect(
      screen.getByText("Add a morning prompt in Settings → Ritual"),
    ).toBeTruthy();
    expect(screen.queryByTestId("journal-response-0")).toBeNull();
  });

  describe("with prompts split across the two rituals", () => {
    const DAY: TJournalPrompt[] = [
      { prompt: "Highlight", response: "shipped it", period: "am" },
      { prompt: "Grateful for", response: "family", period: "am" },
      { prompt: "What went well?", response: "", period: "pm" },
    ];

    it("renders only the prompts belonging to the ritual on screen", () => {
      const screen = setup({ prompts: DAY, mode: "pm" });

      expect(screen.getByText("What went well?")).toBeTruthy();
      expect(screen.queryByText("Highlight")).toBeNull();
      expect(screen.queryByText("Grateful for")).toBeNull();
    });

    // The testID is the entry's position in the **stored** day, not the field's
    // position on screen — the same index the save rebuilds from.
    it("names each field by its index in the stored day, not on screen", () => {
      const screen = setup({ prompts: DAY, mode: "pm" });

      expect(screen.getByTestId("journal-response-2")).toBeTruthy();
      expect(screen.queryByTestId("journal-response-0")).toBeNull();
    });

    // The regression this design is arranged around: `upsertJournal` replaces
    // the whole column, so a subset rebuild would delete the morning's answers.
    it("keeps the other ritual's answers when this one saves", () => {
      jest.useFakeTimers();
      try {
        const screen = setup({ prompts: DAY, mode: "pm" });

        fireEvent.changeText(
          screen.getByTestId("journal-response-2"),
          "the redesign landed",
        );
        act(() => jest.advanceTimersByTime(800));

        expect(mockUpsertJournalAsync).toHaveBeenCalledWith({
          prompts: [
            { prompt: "Highlight", response: "shipped it", period: "am" },
            { prompt: "Grateful for", response: "family", period: "am" },
            {
              prompt: "What went well?",
              response: "the redesign landed",
              period: "pm",
            },
          ],
        });
      } finally {
        jest.useRealTimers();
      }
    });

    // Reachable when a day was started before this ritual had prompts: the
    // template only seeds blank journals, so the step exists but the day is bare.
    it("explains an already-started day with none of this ritual's prompts", () => {
      const screen = setup({
        prompts: [
          { prompt: "Highlight", response: "shipped it", period: "am" },
        ],
        mode: "pm",
      });

      expect(
        screen.getByText(
          "This day was started before you had any evening prompts.",
        ),
      ).toBeTruthy();
      expect(screen.queryByTestId("journal-response-0")).toBeNull();
    });
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

      expect(mockUpsertJournalAsync).toHaveBeenCalledWith({
        prompts: [{ prompt: "Highlight", response: "Half-written" }],
      });
    } finally {
      jest.useRealTimers();
    }
  });

  // The field grows instead of hiding its own content behind a scrollbar;
  // the surrounding ScrollView is what scrolls.
  describe("growing to fit the response", () => {
    const styleOf = (element: ReactTestInstance): ViewStyle =>
      StyleSheet.flatten(element.props.style as ViewStyle);
    const heightOf = (element: ReactTestInstance) => styleOf(element).minHeight;

    // Regression guard: disabling scrollEnabled clamps iOS content size to
    // the view's bounds and silently clips typing (JournalResponseField).
    it("leaves its own scrolling alone so the content can be measured", () => {
      const screen = setup({
        prompts: [{ prompt: "How was today?", response: "" }],
      });
      const input = screen.getByTestId("journal-response-0");

      expect(input.props.scrollEnabled).toBeUndefined();
      expect(styleOf(input).overflow).toBeUndefined();
    });

    // An explicit height beats intrinsic sizing, pinning the field to its
    // mount-time measurement and scrolling everything typed afterward.
    it("floors its size without pinning it, so typing can still grow it", () => {
      const screen = setup({
        prompts: [{ prompt: "How was today?", response: "" }],
      });

      expect(
        styleOf(screen.getByTestId("journal-response-0")).height,
      ).toBeUndefined();
    });

    // Two bugs at once: newline-counted height stayed one line tall for a
    // wrapped paragraph, and applying it as `height` froze mount-time sizing.
    it("floors its height at the measured content, not the newline count", () => {
      const screen = setup({
        prompts: [{ prompt: "How was today?", response: "" }],
      });
      const input = screen.getByTestId("journal-response-0");

      act(() => {
        fireEvent(input, "contentSizeChange", {
          nativeEvent: { contentSize: { height: 300, width: 200 } },
        });
      });

      expect(heightOf(screen.getByTestId("journal-response-0"))).toBe(300);
    });

    it("keeps a one-line floor when the content measures smaller", () => {
      // A zero or missing measurement must not collapse the field to nothing.
      const screen = setup({
        prompts: [{ prompt: "How was today?", response: "" }],
      });
      const floor = heightOf(screen.getByTestId("journal-response-0"));

      act(() => {
        fireEvent(
          screen.getByTestId("journal-response-0"),
          "contentSizeChange",
          {
            nativeEvent: { contentSize: { height: 0, width: 200 } },
          },
        );
      });

      expect(heightOf(screen.getByTestId("journal-response-0"))).toBe(floor);
      expect(floor).toBeGreaterThan(0);
    });

    // Uncontrolled input — response never updates after mount, so holding its
    // newline count as a permanent floor would keep a cleared answer's box tall.
    it("drops the seeded floor once a shorter measurement arrives", () => {
      const screen = setup({
        prompts: [{ prompt: "How was today?", response: "one\ntwo\nthree" }],
      });
      const seeded = heightOf(screen.getByTestId("journal-response-0"));

      // The user clears the answer; the field remeasures at one line.
      act(() => {
        fireEvent(
          screen.getByTestId("journal-response-0"),
          "contentSizeChange",
          { nativeEvent: { contentSize: { height: 20, width: 200 } } },
        );
      });

      const measured = heightOf(screen.getByTestId("journal-response-0"));
      expect(measured).toBeLessThan(seeded as number);
    });
  });

  describe("mood (DEX-191)", () => {
    it("offers all five faces above the prompts", () => {
      const screen = setup({
        prompts: [{ prompt: "How was today?", response: "" }],
      });

      [1, 2, 3, 4, 5].forEach((rating) =>
        expect(screen.getByTestId(`mood-face-${rating}`)).toBeTruthy(),
      );
    });

    it("saves a tapped face immediately, without the response debounce", () => {
      const screen = setup({
        prompts: [{ prompt: "How was today?", response: "" }],
      });

      fireEvent.press(screen.getByTestId("mood-face-4"));

      expect(mockUpsertJournal).toHaveBeenCalledWith({ mood: 4 });
    });

    it("marks the saved face selected and leaves every face tappable", () => {
      const screen = setup({
        prompts: [{ prompt: "How was today?", response: "" }],
        mood: 2,
      });

      expect(
        screen.getByTestId("mood-face-2").props.accessibilityState.selected,
      ).toBe(true);
      expect(
        screen.getByTestId("mood-face-5").props.accessibilityState.selected,
      ).toBe(false);

      fireEvent.press(screen.getByTestId("mood-face-5"));
      expect(mockUpsertJournal).toHaveBeenCalledWith({ mood: 5 });
    });

    // A day whose stored prompts predate this ritual's is the one place the
    // step renders with nothing to write in — a mood is still recordable.
    it("still offers the scale when this ritual has no prompts on the day", () => {
      const screen = setup({
        prompts: [{ prompt: "Morning only", response: "", period: "am" }],
        mode: "pm",
        exists: true,
      });

      expect(screen.queryByTestId("journal-response-0")).toBeNull();
      fireEvent.press(screen.getByTestId("mood-face-3"));
      expect(mockUpsertJournal).toHaveBeenCalledWith({ mood: 3 });
    });
  });
});
