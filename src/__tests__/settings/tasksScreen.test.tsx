import { fireEvent, render } from "@testing-library/react-native";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import { TTemplate } from "@/api/templates";
import TasksScreen from "@/app/(app)/(tabs)/settings/tasks";
import { useIsMultiPane } from "@/hooks/useIsMultiPane";
import { usePreferences } from "@/hooks/usePreferences";
import { useTasks } from "@/hooks/useTasks";
import { useTemplates } from "@/hooks/useTemplates";
import {
  pickerOptions,
  pickerProps,
  resetPicker,
} from "@/testUtils/mockExpoUiPicker";

jest.mock("@/hooks/useTemplates", () => ({ useTemplates: jest.fn() }));
// useTasks pulls in the supabase client via useAuth; the screen only reads the
// cached tasks to tell a live repeat from a stalled one.
jest.mock("@/hooks/useTasks", () => ({ useTasks: jest.fn() }));
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
const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;
const mockUpdatePreferences = jest.fn();
const mockCreateNextOccurrence = jest.fn();

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

const makeTask = (overrides: Partial<TTask> = {}): TTask => ({
  id: "task-1",
  alarmTime: null,
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.NEITHER,
  scheduledFor: "2026-07-27",
  status: ETaskStatus.TODO,
  subtasks: [],
  templateId: "template-1",
  title: "Water the plants",
  ...overrides,
});

/**
 * Renders with every template holding one open task — the state the
 * one-open-task invariant guarantees, so a row describes its cadence rather
 * than warning about it. Pass `tasks` explicitly to render a stalled repeat.
 */
const renderWith = (templates: TTemplate[], tasks?: TTask[]) => {
  mockUseTemplates.mockReturnValue([
    templates,
    { createNextOccurrence: mockCreateNextOccurrence } as never,
  ]);
  mockUseTasks.mockReturnValue([
    tasks ??
      templates.map((template, index) =>
        makeTask({ id: `task-${index}`, templateId: template.id }),
      ),
    {} as never,
  ]);
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

    expect(screen.getByTestId("safe-area-edges-right")).toBeTruthy();
  });

  it("includes the left safe-area edge in single-column mode", () => {
    mockUseIsMultiPane.mockReturnValue(false);
    const screen = renderWith([]);

    expect(screen.getByTestId("safe-area-edges-left,right")).toBeTruthy();
  });

  it("explains where each kind of saved task comes from when there are none", () => {
    const screen = renderWith([]);

    expect(screen.getByText(/open its menu and choose Repeat/i)).toBeTruthy();
    expect(screen.getByText(/choose Save as template/i)).toBeTruthy();
  });

  it("lists each repeat task with a human-readable schedule", () => {
    const screen = renderWith([makeTemplate()]);

    expect(screen.getByText("Repeat tasks")).toBeTruthy();
    expect(screen.getByText("Water the plants")).toBeTruthy();
    expect(screen.getByText("Weekly on Mon")).toBeTruthy();
  });

  // Both kinds live in one table; the schedule is the only thing separating
  // them, so a mix must not leak across the two sections (DEX-65).
  it("sorts scheduleless rows into Task templates, described by their checklist", () => {
    const screen = renderWith([
      makeTemplate(),
      makeTemplate({
        id: "template-2",
        schedule: null,
        title: "Trip packing",
        subtasks: [
          { id: "s1", title: "Passport" },
          { id: "s2", title: "Charger" },
        ],
      }),
    ]);

    expect(screen.getByText("Task templates")).toBeTruthy();
    expect(screen.getByText("Trip packing")).toBeTruthy();
    expect(screen.getByText("2 steps")).toBeTruthy();
    // The repeat section keeps its own row and says nothing about the template.
    expect(screen.getByText("Weekly on Mon")).toBeTruthy();
    expect(screen.queryByText("Doesn't repeat")).toBe(null);
  });

  it("opens the same editor from either section", () => {
    const screen = renderWith([
      makeTemplate(),
      makeTemplate({ id: "template-2", schedule: null, title: "Trip packing" }),
    ]);

    fireEvent.press(screen.getByLabelText("Edit Water the plants"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/settings/tasks/[id]",
      params: { id: "template-1" },
    });

    fireEvent.press(screen.getByLabelText("Edit Trip packing"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/settings/tasks/[id]",
      params: { id: "template-2" },
    });
  });

  // A repeat fires by *completing* one of its tasks, so one with none left open
  // can never fire again. It says so instead of quietly describing a cadence it
  // will never act on, and the button is the recovery path for a spawn that
  // failed mid-flight — which the cadence-time auto-seed can never see.
  describe("a stalled repeat", () => {
    const stalledLabel = "Create next Water the plants";

    it("says it isn't recurring and offers to create the next task", () => {
      const screen = renderWith([makeTemplate()], []);

      expect(
        screen.getByText("Not recurring — no open task to repeat from"),
      ).toBeTruthy();
      // The cadence is what the row is failing to do, so it isn't restated.
      expect(screen.queryByText("Weekly on Mon")).toBe(null);

      fireEvent.press(screen.getByLabelText(stalledLabel));
      expect(mockCreateNextOccurrence).toHaveBeenCalledWith(
        expect.objectContaining({ id: "template-1" }),
      );
    });

    // The repair button is a second tap target inside the row, so the row must
    // still open the editor rather than being swallowed by it.
    it("still opens the editor from the row itself", () => {
      const screen = renderWith([makeTemplate()], []);

      fireEvent.press(screen.getByLabelText("Edit Water the plants"));

      expect(mockPush).toHaveBeenCalledWith({
        pathname: "/settings/tasks/[id]",
        params: { id: "template-1" },
      });
      expect(mockCreateNextOccurrence).not.toHaveBeenCalled();
    });

    it("says nothing of the sort while an open task remains", () => {
      const screen = renderWith([makeTemplate()]);

      expect(screen.getByText("Weekly on Mon")).toBeTruthy();
      expect(screen.queryByLabelText(stalledLabel)).toBe(null);
    });

    // A completed occurrence is not an open one: the link stays behind, so
    // counting links rather than open tasks would call this repeat healthy.
    it("ignores a linked task that has been checked off", () => {
      const screen = renderWith(
        [makeTemplate()],
        [makeTask({ status: ETaskStatus.DONE })],
      );

      expect(
        screen.getByText("Not recurring — no open task to repeat from"),
      ).toBeTruthy();
    });

    // A task template is stamped out on demand and recurs from nothing, so it
    // has nothing to stall.
    it("never flags a task template", () => {
      const screen = renderWith(
        [makeTemplate({ id: "template-2", schedule: null, title: "Packing" })],
        [],
      );

      expect(screen.getByText("No checklist")).toBeTruthy();
      expect(screen.queryByLabelText("Create next Packing")).toBe(null);
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
