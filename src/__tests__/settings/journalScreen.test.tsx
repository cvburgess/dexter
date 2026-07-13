import { fireEvent, render } from "@testing-library/react-native";

import JournalScreen from "@/app/(app)/(tabs)/settings/journal";
import { useIsMultiPane } from "@/hooks/useIsMultiPane";
import { usePreferences } from "@/hooks/usePreferences";

jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));
jest.mock("@/hooks/useIsMultiPane", () => ({ useIsMultiPane: jest.fn() }));

jest.mock("react-native-safe-area-context", () =>
  require("@/testUtils/mockSafeAreaEdges").mockSafeAreaContext(),
);

const mockSetOptions = jest.fn();
jest.mock("expo-router", () => ({
  useNavigation: () => ({ setOptions: mockSetOptions }),
}));

const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;
const mockUseIsMultiPane = useIsMultiPane as jest.MockedFunction<
  typeof useIsMultiPane
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

// The "Add prompt" affordance lives in the navigation header (set via
// setOptions), so it isn't in the screen's own tree. Render the latest
// headerRight to inspect/press it.
const renderHeader = () => {
  const options = mockSetOptions.mock.calls.at(-1)?.[0];
  return render(options.headerRight());
};

describe("JournalScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsMultiPane.mockReturnValue(false);
  });

  it("skips the left safe-area edge in two-pane mode (sidebar owns it)", () => {
    mockUseIsMultiPane.mockReturnValue(true);
    const screen = renderWith({ enableJournal: true });

    expect(screen.getByTestId("safe-area-edges-bottom,right")).toBeTruthy();
  });

  it("includes the left safe-area edge in single-column mode", () => {
    mockUseIsMultiPane.mockReturnValue(false);
    const screen = renderWith({ enableJournal: true });

    expect(
      screen.getByTestId("safe-area-edges-bottom,left,right"),
    ).toBeTruthy();
  });

  it("reflects the enabled state and toggles it", () => {
    const screen = renderWith({ enableJournal: true });

    expect(screen.getByLabelText("Journal").props.value).toBe(true);

    fireEvent(screen.getByLabelText("Journal"), "valueChange", false);

    expect(mockUpdate).toHaveBeenCalledWith({ enableJournal: false });
  });

  it("hides the prompts editor and header add button when Journal is disabled", () => {
    const screen = renderWith({
      enableJournal: false,
      templatePrompts: ["Highlight"],
    });

    expect(screen.queryByLabelText("Journal prompt 1")).toBeNull();
    expect(renderHeader().queryByLabelText("Add prompt")).toBeNull();
  });

  it("shows the header add button when Journal is enabled", () => {
    renderWith({ enableJournal: true });

    expect(renderHeader().getByLabelText("Add prompt")).toBeTruthy();
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

  it("appends an empty prompt when the header add button is pressed", () => {
    renderWith({
      enableJournal: true,
      templatePrompts: ["Highlight"],
    });

    fireEvent.press(renderHeader().getByLabelText("Add prompt"));

    expect(mockUpdate).toHaveBeenCalledWith({
      templatePrompts: ["Highlight", ""],
    });
  });

  it("preserves an in-progress edit when a prompt is added", () => {
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
    // Re-read the header after the edit so it closes over the latest drafts.
    fireEvent.press(renderHeader().getByLabelText("Add prompt"));

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
