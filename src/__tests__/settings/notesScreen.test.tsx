import { fireEvent, render } from "@testing-library/react-native";

import NotesScreen from "@/app/(app)/(tabs)/settings/notes";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { usePreferences } from "@/hooks/usePreferences";

jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));
jest.mock("@/hooks/useIsLargeDevice", () => ({ useIsLargeDevice: jest.fn() }));

jest.mock("react-native-safe-area-context", () =>
  require("@/testUtils/mockSafeAreaEdges").mockSafeAreaContext(),
);

const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;
const mockUseIsLargeDevice = useIsLargeDevice as jest.MockedFunction<
  typeof useIsLargeDevice
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
    mockUseIsLargeDevice.mockReturnValue(false);
  });

  it("skips the left safe-area edge in two-pane mode (sidebar owns it)", () => {
    mockUseIsLargeDevice.mockReturnValue(true);
    const screen = renderWith({ enableNotes: true });

    expect(screen.getByTestId("safe-area-edges-right")).toBeTruthy();
  });

  it("includes the left safe-area edge in single-column mode", () => {
    mockUseIsLargeDevice.mockReturnValue(false);
    const screen = renderWith({ enableNotes: true });

    expect(screen.getByTestId("safe-area-edges-left,right")).toBeTruthy();
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
