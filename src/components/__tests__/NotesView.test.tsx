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
  exists = false,
  isLoading = false,
  templateNote = "",
}: {
  notes?: string;
  exists?: boolean;
  isLoading?: boolean;
  templateNote?: string;
} = {}) => {
  mockUseDays.mockReturnValue([
    { date: "2026-07-12", notes, prompts: [] },
    { isLoading, exists, upsertDay: mockUpsertDay },
  ]);
  mockUsePreferences.mockReturnValue([
    { templateNote } as never,
    { updatePreferences: jest.fn() },
  ]);
  return render(<NotesView date="2026-07-12" />);
};

describe("NotesView", () => {
  beforeEach(() => jest.clearAllMocks());

  it("offers the template choice when no row exists yet and a template is set", () => {
    const screen = setup({ exists: false, templateNote: "# Daily" });

    expect(screen.getByText("Use daily note template")).toBeTruthy();
    expect(screen.getByText("Blank note")).toBeTruthy();
    expect(screen.queryByLabelText("note-editor")).toBeNull();
  });

  it("seeds the template when 'Use daily note template' is chosen", () => {
    const screen = setup({ exists: false, templateNote: "# Daily" });

    fireEvent.press(screen.getByText("Use daily note template"));

    expect(mockUpsertDay).toHaveBeenCalledWith({ notes: "# Daily" });
  });

  it("writes an empty note row when 'Blank note' is chosen", () => {
    const screen = setup({ exists: false, templateNote: "# Daily" });

    fireEvent.press(screen.getByText("Blank note"));

    expect(mockUpsertDay).toHaveBeenCalledWith({ notes: "" });
  });

  it("shows the editor once a row exists, even when the note is empty", () => {
    // Covers both a persisted 'Blank note' choice and clearing a note to empty:
    // the chooser must not resurface just because the content is blank.
    const screen = setup({ exists: true, notes: "", templateNote: "# Daily" });

    expect(screen.queryByText("Use daily note template")).toBeNull();
    expect(screen.getByLabelText("note-editor")).toBeTruthy();
  });

  it("shows the editor seeded with an existing note", () => {
    const screen = setup({
      exists: true,
      notes: "existing note",
      templateNote: "# Daily",
    });

    expect(screen.queryByText("Use daily note template")).toBeNull();
    expect(screen.getByText("seed:existing note")).toBeTruthy();
  });

  it("skips the chooser when no template is configured", () => {
    const screen = setup({ exists: false, templateNote: "" });

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
      const screen = setup({ exists: true, notes: "existing note" });

      fireEvent.press(screen.getByLabelText("note-editor"));
      expect(mockUpsertDay).not.toHaveBeenCalled();

      act(() => jest.advanceTimersByTime(800));

      expect(mockUpsertDay).toHaveBeenCalledWith({ notes: "edited note" });
    } finally {
      jest.useRealTimers();
    }
  });
});
