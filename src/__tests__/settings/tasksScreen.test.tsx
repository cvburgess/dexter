import { fireEvent, render } from "@testing-library/react-native";

import { ETaskPriority } from "@/api/tasks";
import { TTemplate } from "@/api/templates";
import TasksScreen from "@/app/(app)/(tabs)/settings/tasks";
import { useIsMultiPane } from "@/hooks/useIsMultiPane";
import { usePreferences } from "@/hooks/usePreferences";
import { useTemplates } from "@/hooks/useTemplates";
import {
  pickerOptions,
  pickerProps,
  resetPicker,
} from "@/testUtils/mockExpoUiPicker";

jest.mock("@/hooks/useTemplates", () => ({ useTemplates: jest.fn() }));
jest.mock("@/hooks/useIsMultiPane", () => ({ useIsMultiPane: jest.fn() }));
// usePreferences pulls in the supabase client; the screen only reads the sound.
jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));

// The global @expo/ui mock renders Picker as null, so it can't be driven from a
// test — capture its props instead.
jest.mock("@expo/ui", () =>
  jest
    .requireActual<typeof import("@/testUtils/mockExpoUiPicker")>(
      "@/testUtils/mockExpoUiPicker",
    )
    .mockExpoUiPicker(),
);

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
const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;
const mockUpdatePreferences = jest.fn();

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
    mockUsePreferences.mockReturnValue([
      { alarmSound: "echos" } as never,
      { updatePreferences: mockUpdatePreferences },
    ]);
    resetPicker();
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
    expect(pickerProps()?.selectedValue).toBe("echos");
  });

  it("falls back to System for a stored sound this build doesn't ship", () => {
    // Otherwise the picker renders with nothing selected and the user can't
    // tell what their alarms will ring.
    mockUsePreferences.mockReturnValue([
      { alarmSound: "chimes" } as never,
      { updatePreferences: mockUpdatePreferences },
    ]);
    renderWith([]);

    expect(pickerProps()?.selectedValue).toBe("system");
  });

  it("saves the alarm sound when a different one is picked", () => {
    renderWith([]);

    const onValueChange = pickerProps()?.onValueChange as (
      value: string,
    ) => void;
    onValueChange("system");

    expect(mockUpdatePreferences).toHaveBeenCalledWith({
      alarmSound: "system",
    });
  });
});
