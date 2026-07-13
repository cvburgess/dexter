import { fireEvent, render } from "@testing-library/react-native";

import NotesScreen from "@/app/(app)/(tabs)/settings/notes";
import { usePreferences } from "@/hooks/usePreferences";

jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));

const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
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
  beforeEach(() => jest.clearAllMocks());

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
