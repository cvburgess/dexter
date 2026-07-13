import { fireEvent, render } from "@testing-library/react-native";
import type { StyleProp, ViewStyle } from "react-native";
import type { Edge } from "react-native-safe-area-context";

import HabitsScreen from "@/app/(app)/(tabs)/settings/habits";
import { useHabits } from "@/hooks/useHabits";
import { useIsMultiPane } from "@/hooks/useIsMultiPane";
import { usePreferences } from "@/hooks/usePreferences";

jest.mock("@/hooks/useHabits", () => ({ useHabits: jest.fn() }));
jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));
jest.mock("@/hooks/useIsMultiPane", () => ({ useIsMultiPane: jest.fn() }));

// The project-wide react-native-safe-area-context mock doesn't stub
// SafeAreaView itself, so `edges` isn't otherwise observable in a render
// tree — expose it via testID to assert on the two-pane/single-pane split.
jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual(
    "react-native-safe-area-context/jest/mock",
  ).default;
  const { View } = require("react-native");
  return {
    ...actual,
    SafeAreaView: ({
      children,
      edges,
      style,
    }: {
      children: React.ReactNode;
      edges?: Edge[];
      style?: StyleProp<ViewStyle>;
    }) => (
      <View testID={`safe-area-edges-${(edges ?? []).join(",")}`} style={style}>
        {children}
      </View>
    ),
  };
});

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
const mockUseIsMultiPane = useIsMultiPane as jest.MockedFunction<
  typeof useIsMultiPane
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
    mockUseIsMultiPane.mockReturnValue(false);
  });

  it("skips the left safe-area edge in two-pane mode (sidebar owns it)", () => {
    mockUseIsMultiPane.mockReturnValue(true);
    const screen = renderWith({ enableHabits: true });

    expect(screen.getByTestId("safe-area-edges-bottom,right")).toBeTruthy();
  });

  it("includes the left safe-area edge in single-column mode", () => {
    mockUseIsMultiPane.mockReturnValue(false);
    const screen = renderWith({ enableHabits: true });

    expect(
      screen.getByTestId("safe-area-edges-bottom,left,right"),
    ).toBeTruthy();
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
