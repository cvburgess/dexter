import { act, fireEvent, render } from "@testing-library/react-native";
import type { ReactTestInstance } from "react-test-renderer";
import { ScrollView, StyleSheet, type ViewStyle } from "react-native";

import { TJournalPrompt } from "@/api/journals";
import { useJournals } from "@/hooks/useJournals";

import { JournalView } from "../JournalView";

jest.mock("@/hooks/useJournals", () => ({ useJournals: jest.fn() }));

const mockUseJournals = useJournals as jest.MockedFunction<typeof useJournals>;
const mockUpsertJournal = jest.fn();
const mockUpsertJournalAsync = jest.fn().mockResolvedValue(undefined);

const setup = ({
  prompts = [],
  isLoading = false,
  onEditingChange,
}: {
  prompts?: TJournalPrompt[];
  isLoading?: boolean;
  onEditingChange?: (editing: boolean) => void;
} = {}) => {
  mockUseJournals.mockReturnValue([
    { date: "2026-07-12", prompts },
    {
      isLoading,
      exists: prompts.length > 0,
      upsertJournal: mockUpsertJournal,
      upsertJournalAsync: mockUpsertJournalAsync,
    },
  ]);
  return render(
    <JournalView date="2026-07-12" onEditingChange={onEditingChange} />,
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
      screen.queryByText("Add journal prompts in Settings → Journal"),
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
    const heightOf = (element: ReactTestInstance) => styleOf(element).height;

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

    // The bug this replaced: height came from counting "\n", so a paragraph
    // typed without a single Enter stayed one line tall and scrolled.
    it("takes its height from the measured content, not the newline count", () => {
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
  });
});
