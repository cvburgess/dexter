import { act, fireEvent, render } from "@testing-library/react-native";
import { Text, TouchableOpacity } from "react-native";

import { useDays } from "@/hooks/useDays";
import { usePreferences } from "@/hooks/usePreferences";

import { NotesView } from "../NotesView";

jest.mock("@/hooks/useDays", () => ({ useDays: jest.fn() }));
jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));

// Stand in for the platform editor (native lib has no test double). Surface the
// seeded value and let a press simulate a markdown edit.
const mockNoteEditor = jest.fn(
  ({
    initialValue,
    onChangeMarkdown,
  }: {
    initialValue: string;
    onChangeMarkdown: (md: string) => void;
  }) => (
    <TouchableOpacity
      accessibilityLabel="note-editor"
      onPress={() => onChangeMarkdown("edited note")}
    >
      <Text>seed:{initialValue}</Text>
    </TouchableOpacity>
  ),
);
jest.mock("@/components/NoteEditor", () => ({
  NoteEditor: (props: Parameters<typeof mockNoteEditor>[0]) =>
    mockNoteEditor(props),
}));

const mockUseDays = useDays as jest.MockedFunction<typeof useDays>;
const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;
const mockUpsertDay = jest.fn();

const setup = ({
  notes = "",
  isLoading = false,
  templateNote = "",
}: { notes?: string; isLoading?: boolean; templateNote?: string } = {}) => {
  mockUseDays.mockReturnValue([
    { date: "2026-07-12", notes, prompts: [] },
    { isLoading, upsertDay: mockUpsertDay },
  ]);
  mockUsePreferences.mockReturnValue([
    { templateNote } as never,
    { updatePreferences: jest.fn() },
  ]);
  return render(<NotesView date="2026-07-12" />);
};

describe("NotesView", () => {
  beforeEach(() => jest.clearAllMocks());

  it("offers the template choice for a blank day when a template is set", () => {
    const screen = setup({ notes: "", templateNote: "# Daily" });

    expect(screen.getByText("Use daily note template")).toBeTruthy();
    expect(screen.getByText("Blank note")).toBeTruthy();
    expect(screen.queryByLabelText("note-editor")).toBeNull();
  });

  it("seeds the template when 'Use daily note template' is chosen", () => {
    const screen = setup({ notes: "", templateNote: "# Daily" });

    fireEvent.press(screen.getByText("Use daily note template"));

    expect(mockUpsertDay).toHaveBeenCalledWith({ notes: "# Daily" });
  });

  it("opens a blank editor when 'Blank note' is chosen", () => {
    const screen = setup({ notes: "", templateNote: "# Daily" });

    fireEvent.press(screen.getByText("Blank note"));

    expect(screen.getByLabelText("note-editor")).toBeTruthy();
    expect(screen.queryByText("Use daily note template")).toBeNull();
    expect(mockUpsertDay).not.toHaveBeenCalled();
  });

  it("skips the chooser and shows the editor when the note is not blank", () => {
    const screen = setup({ notes: "existing note", templateNote: "# Daily" });

    expect(screen.queryByText("Use daily note template")).toBeNull();
    expect(screen.getByText("seed:existing note")).toBeTruthy();
  });

  it("does not resurrect the chooser when an active edit clears the note", () => {
    const screen = setup({ notes: "existing note", templateNote: "# Daily" });

    // Start editing, then let the optimistic cache report the note as empty.
    fireEvent.press(screen.getByLabelText("note-editor"));
    mockUseDays.mockReturnValue([
      { date: "2026-07-12", notes: "", prompts: [] },
      { isLoading: false, upsertDay: mockUpsertDay },
    ]);
    screen.rerender(<NotesView date="2026-07-12" />);

    expect(screen.queryByText("Use daily note template")).toBeNull();
    expect(screen.getByLabelText("note-editor")).toBeTruthy();
  });

  it("skips the chooser when no template is configured", () => {
    const screen = setup({ notes: "", templateNote: "" });

    expect(screen.queryByText("Use daily note template")).toBeNull();
    expect(screen.getByLabelText("note-editor")).toBeTruthy();
  });

  it("shows a loading indicator and no chooser while the day loads", () => {
    const screen = setup({ isLoading: true, templateNote: "# Daily" });

    expect(screen.queryByText("Use daily note template")).toBeNull();
    expect(screen.queryByLabelText("note-editor")).toBeNull();
  });

  it("autosaves edits after the debounce window elapses", () => {
    jest.useFakeTimers();
    try {
      const screen = setup({ notes: "existing note" });

      fireEvent.press(screen.getByLabelText("note-editor"));
      expect(mockUpsertDay).not.toHaveBeenCalled();

      act(() => jest.advanceTimersByTime(800));

      expect(mockUpsertDay).toHaveBeenCalledWith({ notes: "edited note" });
    } finally {
      jest.useRealTimers();
    }
  });
});
