import { fireEvent, render } from "@testing-library/react-native";

import HabitsScreen from "@/app/(app)/(tabs)/settings/habits";
import { useHabits } from "@/hooks/useHabits";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { usePreferences } from "@/hooks/usePreferences";

jest.mock("@/hooks/useHabits", () => ({ useHabits: jest.fn() }));
jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));
jest.mock("@/hooks/useIsLargeDevice", () => ({ useIsLargeDevice: jest.fn() }));

jest.mock("react-native-safe-area-context", () =>
  require("@/testUtils/mockSafeAreaEdges").mockSafeAreaContext(),
);

const mockSetOptions = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useNavigation: () => ({ setOptions: mockSetOptions }),
  useRouter: () => ({ push: mockPush }),
}));

const mockUseHabits = useHabits as jest.MockedFunction<typeof useHabits>;
const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;
const mockUseIsLargeDevice = useIsLargeDevice as jest.MockedFunction<
  typeof useIsLargeDevice
>;
const mockUpdate = jest.fn();

const renderWith = (overrides: { enableHabits?: boolean } = {}) => {
  mockUseHabits.mockReturnValue([[], { updateHabit: jest.fn() } as never]);
  mockUsePreferences.mockReturnValue([
    { enableHabits: true, ...overrides } as never,
    { updatePreferences: mockUpdate },
  ]);
  return render(<HabitsScreen />);
};

// The "+" add button lives in the navigation header (set via setOptions), so
// render the latest headerRight to inspect/press it.
const renderHeader = () => {
  const options = mockSetOptions.mock.calls.at(-1)?.[0];
  return render(options.headerRight());
};

describe("HabitsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsLargeDevice.mockReturnValue(false);
  });

  it("skips the left safe-area edge in two-pane mode (sidebar owns it)", () => {
    mockUseIsLargeDevice.mockReturnValue(true);
    const screen = renderWith({ enableHabits: true });

    expect(screen.getByTestId("safe-area-edges-right")).toBeTruthy();
  });

  it("includes the left safe-area edge in single-column mode", () => {
    mockUseIsLargeDevice.mockReturnValue(false);
    const screen = renderWith({ enableHabits: true });

    expect(screen.getByTestId("safe-area-edges-left,right")).toBeTruthy();
  });

  it("shows the header add button when habit tracking is enabled", () => {
    renderWith({ enableHabits: true });

    expect(renderHeader().getByLabelText("New habit")).toBeTruthy();
  });

  it("hides the header add button when habit tracking is disabled", () => {
    renderWith({ enableHabits: false });

    expect(renderHeader().queryByLabelText("New habit")).toBeNull();
  });

  it("opens the new-habit modal when the add button is pressed", () => {
    renderWith({ enableHabits: true });

    fireEvent.press(renderHeader().getByLabelText("New habit"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/settings/habits/[id]",
      params: { id: "new" },
    });
  });
});
