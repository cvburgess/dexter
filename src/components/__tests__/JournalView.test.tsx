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

// `mode` defaults to the morning, and prompts written without a `period` read
// as morning too (`promptPeriod`), so a case that says nothing about periods
// exercises exactly what it did before DEX-151.
const setup = ({
  prompts = [],
  isLoading = false,
  mode = "am",
  exists,
  onEditingChange,
}: {
  prompts?: TJournalPrompt[];
  isLoading?: boolean;
  mode?: TRitualMode;
  exists?: boolean;
  onEditingChange?: (editing: boolean) => void;
} = {}) => {
  mockUseJournals.mockReturnValue([
    { date: "2026-07-12", prompts },
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

  // Without this, a focused response field low on the screen stays under the
  // keyboard: the wrapper this replaced padded the scroller's frame, which gave
  // scroll room but never moved content to the field (DEX-92).
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

    // The regression this whole design is arranged around. `upsertJournal`
    // replaces the entire jsonb column, so an evening save rebuilt from the
    // fields the evening renders would write a one-entry array over the row and
    // delete the morning's answers for that day.
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

    // Reachable whenever a day was started before this period had any prompts:
    // the template only seeds days with a blank journal, so the step is in the
    // ritual (the template has prompts) while this particular day has none.
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

  // The field is prose the user is writing, so it grows instead of hiding the
  // top of its own content behind a scrollbar; the surrounding ScrollView is
  // what scrolls.
  describe("growing to fit the response", () => {
    const styleOf = (element: ReactTestInstance): ViewStyle =>
      StyleSheet.flatten(element.props.style as ViewStyle);
    const heightOf = (element: ReactTestInstance) => styleOf(element).minHeight;

    // Regression guard, not a style preference. Disabling the input's own
    // scrolling to "enforce" that it never scrolls makes iOS report a content
    // size clamped to the view's bounds, so the measurement below only echoes
    // back the height already set and the field can never grow past its first
    // line — with `overflow: hidden` on top, that silently clips what is being
    // typed. Growth is what removes the scrollbar; see `JournalResponseField`.
    it("leaves its own scrolling alone so the content can be measured", () => {
      const screen = setup({
        prompts: [{ prompt: "How was today?", response: "" }],
      });
      const input = screen.getByTestId("journal-response-0");

      expect(input.props.scrollEnabled).toBeUndefined();
      expect(styleOf(input).overflow).toBeUndefined();
    });

    // The other half of the same rule: an explicit `height` beats the intrinsic
    // size a multiline TextInput derives from its own text, which pinned the
    // field to its mount-time measurement and left everything typed afterwards
    // scrolling inside it.
    it("floors its size without pinning it, so typing can still grow it", () => {
      const screen = setup({
        prompts: [{ prompt: "How was today?", response: "" }],
      });

      expect(
        styleOf(screen.getByTestId("journal-response-0")).height,
      ).toBeUndefined();
    });

    // Two bugs this pins at once: height came from counting "\n", so a
    // paragraph typed without a single Enter stayed one line tall; and it was
    // applied as `height`, which overrode the intrinsic sizing that grows the
    // field as you type and froze it at the mount-time measurement.
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

    // The seed is only good until the field measures itself. `response` is the
    // saved answer at mount and never changes after it (the input is
    // uncontrolled, and typing writes refs rather than state), so holding its
    // newline count as the floor would leave a cleared five-line answer's box
    // five lines tall.
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
});
