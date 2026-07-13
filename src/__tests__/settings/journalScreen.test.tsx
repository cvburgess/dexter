import { fireEvent, render } from "@testing-library/react-native";

import JournalScreen from "@/app/(app)/(tabs)/settings/journal";
import { usePreferences } from "@/hooks/usePreferences";

jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));

const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;
const mockUpdate = jest.fn();

const renderWith = (
  overrides: { enableJournal?: boolean; templatePrompts?: string[] } = {},
) => {
  mockUsePreferences.mockReturnValue([
    { enableJournal: true, templatePrompts: [], ...overrides } as never,
    { updatePreferences: mockUpdate },
  ]);
  return render(<JournalScreen />);
};

describe("JournalScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reflects the enabled state and toggles it", () => {
    const screen = renderWith({ enableJournal: true });

    expect(screen.getByLabelText("Journal").props.value).toBe(true);

    fireEvent(screen.getByLabelText("Journal"), "valueChange", false);

    expect(mockUpdate).toHaveBeenCalledWith({ enableJournal: false });
  });

  it("hides the prompts editor when Journal is disabled", () => {
    const screen = renderWith({
      enableJournal: false,
      templatePrompts: ["Highlight"],
    });

    expect(screen.queryByLabelText("Journal prompt 1")).toBeNull();
    expect(screen.queryByText("Add prompt")).toBeNull();
  });

  it("commits an edited prompt on blur, replacing it by index", () => {
    const screen = renderWith({
      enableJournal: true,
      templatePrompts: ["Highlight", "Grateful for"],
    });

    const input = screen.getByLabelText("Journal prompt 1");
    fireEvent.changeText(input, "What went well?");
    fireEvent(input, "blur");

    expect(mockUpdate).toHaveBeenCalledWith({
      templatePrompts: ["What went well?", "Grateful for"],
    });
  });

  it("does not write a prompt on blur when it is unchanged", () => {
    const screen = renderWith({
      enableJournal: true,
      templatePrompts: ["Highlight"],
    });

    fireEvent(screen.getByLabelText("Journal prompt 1"), "blur");

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("appends an empty prompt when Add prompt is pressed", () => {
    const screen = renderWith({
      enableJournal: true,
      templatePrompts: ["Highlight"],
    });

    fireEvent.press(screen.getByText("Add prompt"));

    expect(mockUpdate).toHaveBeenCalledWith({
      templatePrompts: ["Highlight", ""],
    });
  });

  it("preserves an in-progress edit when Add prompt is pressed", () => {
    // Add derives the new array from local drafts, not the (optimistically
    // lagging) stored preference — so a typed-but-not-yet-blurred edit survives.
    const screen = renderWith({
      enableJournal: true,
      templatePrompts: ["Highlight"],
    });

    fireEvent.changeText(
      screen.getByLabelText("Journal prompt 1"),
      "What went well?",
    );
    fireEvent.press(screen.getByText("Add prompt"));

    expect(mockUpdate).toHaveBeenCalledWith({
      templatePrompts: ["What went well?", ""],
    });
  });

  it("removes a prompt by index when its delete control is pressed", () => {
    const screen = renderWith({
      enableJournal: true,
      templatePrompts: ["Highlight", "Grateful for"],
    });

    fireEvent.press(screen.getByTestId("delete-prompt-0"));

    expect(mockUpdate).toHaveBeenCalledWith({
      templatePrompts: ["Grateful for"],
    });
  });
});
