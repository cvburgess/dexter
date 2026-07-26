import { fireEvent, render } from "@testing-library/react-native";
import { Children, isValidElement } from "react";

import { ETaskPriority } from "@/api/tasks";
import { TTemplate } from "@/api/templates";
import TasksScreen from "@/app/(app)/(tabs)/settings/tasks";
import { useIsMultiPane } from "@/hooks/useIsMultiPane";
import { useTemplates } from "@/hooks/useTemplates";

jest.mock("@/hooks/useTemplates", () => ({ useTemplates: jest.fn() }));
jest.mock("@/hooks/useIsMultiPane", () => ({ useIsMultiPane: jest.fn() }));

// usePreferences pulls in the supabase client; the screen only reads the sound.
const mockUpdatePreferences = jest.fn();
const preferencesState = { alarmSound: "echos" };
jest.mock("@/hooks/usePreferences", () => ({
  usePreferences: () => [
    { alarmSound: preferencesState.alarmSound },
    { updatePreferences: mockUpdatePreferences },
  ],
}));

// The global @expo/ui mock renders Picker as null, so it can't be driven from a
// test — capture its props locally instead (same approach as PickerField.test).
let lastPickerProps: Record<string, unknown> | null = null;
jest.mock("@expo/ui", () => {
  const Host = ({ children }: { children: React.ReactNode }) => children;
  const Picker = (props: Record<string, unknown>) => {
    lastPickerProps = props;
    return null;
  };
  Picker.Item = function PickerItem() {
    return null;
  };
  return { Host, Picker };
});

const pickerOptions = (): { label: string; value: string }[] =>
  Children.toArray(lastPickerProps?.children as React.ReactNode)
    .filter(isValidElement)
    .map((child) => child.props as { label: string; value: string });

jest.mock("react-native-safe-area-context", () =>
  require("@/testUtils/mockSafeAreaEdges").mockSafeAreaContext(),
);

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const mockUseTemplates = useTemplates as jest.MockedFunction<
  typeof useTemplates
>;
const mockUseIsMultiPane = useIsMultiPane as jest.MockedFunction<
  typeof useIsMultiPane
>;

const makeTemplate = (overrides: Partial<TTemplate> = {}): TTemplate => ({
  id: "template-1",
  alarmTime: null,
  createdAt: "2026-07-01T00:00:00Z",
  goalId: null,
  listId: null,
  priority: ETaskPriority.NEITHER,
  schedule: "0 0 * * 1",
  subtasks: [],
  title: "Water the plants",
  userId: "user-1",
  ...overrides,
});

const renderWith = (templates: TTemplate[]) => {
  mockUseTemplates.mockReturnValue([templates, {} as never]);
  return render(<TasksScreen />);
};

describe("TasksScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsMultiPane.mockReturnValue(false);
    lastPickerProps = null;
    preferencesState.alarmSound = "echos";
  });

  it("skips the left safe-area edge in two-pane mode (sidebar owns it)", () => {
    mockUseIsMultiPane.mockReturnValue(true);
    const screen = renderWith([]);

    expect(screen.getByTestId("safe-area-edges-bottom,right")).toBeTruthy();
  });

  it("includes the left safe-area edge in single-column mode", () => {
    mockUseIsMultiPane.mockReturnValue(false);
    const screen = renderWith([]);

    expect(
      screen.getByTestId("safe-area-edges-bottom,left,right"),
    ).toBeTruthy();
  });

  it("explains where repeats come from when there are none", () => {
    const screen = renderWith([]);

    expect(screen.getByText(/open its menu and choose Repeat/i)).toBeTruthy();
  });

  it("lists each template with a human-readable schedule", () => {
    const screen = renderWith([makeTemplate()]);

    expect(screen.getByText("Water the plants")).toBeTruthy();
    expect(screen.getByText("Weekly on Mon")).toBeTruthy();
  });

  it("opens the editor when a template row is tapped", () => {
    const screen = renderWith([makeTemplate()]);

    fireEvent.press(screen.getByLabelText("Edit Water the plants"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/settings/tasks/[id]",
      params: { id: "template-1" },
    });
  });

  it("offers every alarm sound, with the stored one selected", () => {
    const screen = renderWith([]);

    expect(screen.getByText("Sound")).toBeTruthy();
    expect(pickerOptions()).toEqual([
      { label: "System", value: "system" },
      { label: "Echos", value: "echos" },
    ]);
    expect(lastPickerProps?.selectedValue).toBe("echos");
  });

  it("saves the alarm sound when a different one is picked", () => {
    renderWith([]);

    const onValueChange = lastPickerProps?.onValueChange as (
      value: string,
    ) => void;
    onValueChange("system");

    expect(mockUpdatePreferences).toHaveBeenCalledWith({
      alarmSound: "system",
    });
  });
});
