import { fireEvent, render } from "@testing-library/react-native";

import NotesScreen from "@/app/(app)/(tabs)/settings/notes";
import { useIsMultiPane } from "@/hooks/useIsMultiPane";
import { usePreferences } from "@/hooks/usePreferences";

jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));
jest.mock("@/hooks/useIsMultiPane", () => ({ useIsMultiPane: jest.fn() }));

jest.mock("react-native-safe-area-context", () =>
  require("@/testUtils/mockSafeAreaEdges").mockSafeAreaContext(),
);

const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;
const mockUseIsMultiPane = useIsMultiPane as jest.MockedFunction<
  typeof useIsMultiPane
>;
const mockUpdate = jest.fn();

const renderWith = (
  overrides: { enableNotes?: boolean; templateNote?: string } = {},
) => {
  mockUsePreferences.mockReturnValue([
    { enableNotes: true, templateNote: "", ...overrides } as never,
    { updatePreferences: mockUpdate },
  ]);
  return render(<NotesScreen />);
};

describe("NotesScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsMultiPane.mockReturnValue(false);
  });

  it("skips the left safe-area edge in two-pane mode (sidebar owns it)", () => {
    mockUseIsMultiPane.mockReturnValue(true);
    const screen = renderWith({ enableNotes: true });

    expect(screen.getByTestId("safe-area-edges-bottom,right")).toBeTruthy();
  });

  it("includes the left safe-area edge in single-column mode", () => {
    mockUseIsMultiPane.mockReturnValue(false);
    const screen = renderWith({ enableNotes: true });

    expect(
      screen.getByTestId("safe-area-edges-bottom,left,right"),
    ).toBeTruthy();
  });

  it("reflects the enabled state and toggles it", () => {
    const screen = renderWith({ enableNotes: true });

    fireEvent(screen.getByLabelText("Notes"), "valueChange", false);

    expect(mockUpdate).toHaveBeenCalledWith({ enableNotes: false });
  });

  it("hides the template editor when notes are disabled", () => {
    const screen = renderWith({ enableNotes: false });

    expect(screen.queryByLabelText("Daily note template")).toBeNull();
  });

  it("commits the template on blur", () => {
    const screen = renderWith({ enableNotes: true, templateNote: "" });

    const input = screen.getByLabelText("Daily note template");
    fireEvent.changeText(input, "# Morning");
    fireEvent(input, "blur");

    expect(mockUpdate).toHaveBeenCalledWith({ templateNote: "# Morning" });
  });

  it("does not write the template on blur when it is unchanged", () => {
    const screen = renderWith({ enableNotes: true, templateNote: "# Same" });

    fireEvent(screen.getByLabelText("Daily note template"), "blur");

    expect(mockUpdate).not.toHaveBeenCalledWith({ templateNote: "# Same" });
  });
});
