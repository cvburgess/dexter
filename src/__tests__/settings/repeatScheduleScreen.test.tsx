import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ReactElement } from "react";

import { ETaskPriority } from "@/api/tasks";
import { TTemplate } from "@/api/templates";
import RepeatScheduleScreen from "@/app/(app)/(tabs)/settings/tasks/[id]";
import { useTemplates } from "@/hooks/useTemplates";

jest.mock("@/hooks/useTemplates", () => ({ useTemplates: jest.fn() }));
jest.mock("@/hooks/useLists", () => ({ useLists: () => [[], {}] }));
jest.mock("@/hooks/useGoals", () => ({ useGoals: () => [[], {}] }));

// The prompt itself is covered by ConfirmationModal's own tests; here it only
// has to resolve so the delete path can be exercised.
const mockConfirm = jest.fn<Promise<boolean>, [unknown]>();
jest.mock("@/hooks/useConfirmation", () => ({
  useConfirmation: () => ({
    confirm: mockConfirm,
    confirmationProps: { visible: false, title: "", message: "", actions: [] },
  }),
}));

// The screen renders several PickerFields and the shared @expo/ui mock only
// keeps the last one, so capture them here keyed by their row label instead.
type TPickerFieldProps = {
  label: string;
  options: { label: string; value: string }[];
  selectedValue: string;
  onValueChange: (value: string) => void;
};
const mockPickers: Record<string, TPickerFieldProps> = {};
jest.mock("@/components/PickerField", () => ({
  PickerField: (props: TPickerFieldProps) => {
    mockPickers[props.label] = props;
    return null;
  },
}));

// The screen wires its header through navigation.setOptions on every render;
// the latest call is what the header would be showing.
type THeaderOptions = {
  title?: string;
  headerRight: () => ReactElement;
};
const mockRouter = {
  back: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
  dismissTo: jest.fn(),
  canGoBack: jest.fn(() => true),
};
const mockNavigation = { setOptions: jest.fn<void, [THeaderOptions]>() };
jest.mock("expo-router", () => ({
  Redirect: function Redirect() {
    return null;
  },
  useNavigation: () => mockNavigation,
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ id: "template-1" }),
}));

const headerOptions = (): THeaderOptions =>
  mockNavigation.setOptions.mock.calls.at(-1)![0];

const mockUseTemplates = useTemplates as jest.MockedFunction<
  typeof useTemplates
>;
const mockUpdateTemplate = jest.fn();
const mockDeleteTemplate = jest.fn();

const makeTemplate = (overrides: Partial<TTemplate> = {}): TTemplate => ({
  id: "template-1",
  alarmTime: null,
  createdAt: "2026-07-01T00:00:00Z",
  goalId: null,
  listId: null,
  priority: ETaskPriority.NEITHER,
  schedule: "0 0 * * *",
  subtasks: [],
  title: "Water the plants",
  userId: "user-1",
  ...overrides,
});

const renderWith = (template: TTemplate) => {
  mockUseTemplates.mockReturnValue([
    [template],
    {
      getTemplateById: (id: string | null) =>
        id === template.id ? template : undefined,
      isLoading: false,
      updateTemplate: mockUpdateTemplate,
      deleteTemplate: mockDeleteTemplate,
    } as never,
  ]);
  return render(<RepeatScheduleScreen />);
};

const save = () => {
  const header = render(headerOptions().headerRight());
  fireEvent.press(header.getByTestId("modal-done-button"));
};

describe("RepeatScheduleScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.canGoBack.mockReturnValue(true);
    mockConfirm.mockResolvedValue(true);
    for (const key of Object.keys(mockPickers)) delete mockPickers[key];
  });

  // Opened straight from a task card's menu, this modal has nothing to pop back
  // to on web: a bare `back()` was an unhandled GO_BACK and the ✕/✓ both looked
  // dead. `dismissTo` always resolves to the list this editor details.
  describe("closing", () => {
    it("returns to the template list after saving", () => {
      mockUpdateTemplate.mockImplementation((_diff, { onSuccess }) =>
        onSuccess(),
      );
      renderWith(makeTemplate());

      save();

      expect(mockRouter.dismissTo).toHaveBeenCalledWith("/settings/tasks");
      expect(mockRouter.back).not.toHaveBeenCalled();
    });

    it("returns to the template list after deleting", async () => {
      mockConfirm.mockResolvedValue(true);
      mockDeleteTemplate.mockImplementation((_id, { onSuccess }) =>
        onSuccess(),
      );
      const screen = renderWith(makeTemplate());

      fireEvent.press(screen.getByText("Delete Template"));
      await waitFor(() =>
        expect(mockRouter.dismissTo).toHaveBeenCalledWith("/settings/tasks"),
      );
    });
  });

  it("offers Never alongside the repeat frequencies", () => {
    renderWith(makeTemplate());

    expect(mockPickers["Repeats"].options).toEqual([
      { value: "never", label: "Never" },
      { value: "daily", label: "Daily" },
      { value: "weekly", label: "Weekly" },
      { value: "monthly", label: "Monthly" },
      { value: "yearly", label: "Yearly" },
    ]);
  });

  // Choosing Never is what turns a repeat task into a plain task template.
  it("clears the schedule when Never is chosen", () => {
    renderWith(makeTemplate());

    act(() => mockPickers["Repeats"].onValueChange("never"));
    save();

    expect(mockUpdateTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "template-1", schedule: null }),
      expect.anything(),
    );
  });

  it("still writes a cron expression for a real cadence", () => {
    renderWith(makeTemplate({ schedule: null }));

    act(() => mockPickers["Repeats"].onValueChange("daily"));
    save();

    expect(mockUpdateTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ schedule: "0 0 * * *" }),
      expect.anything(),
    );
  });

  // `parseSchedule` falls back to daily for a null schedule, so reading the
  // frequency off the parse alone would open a template on "Daily".
  it("opens a scheduleless template on Never, titled as a template", () => {
    renderWith(makeTemplate({ schedule: null }));

    expect(mockPickers["Repeats"].selectedValue).toBe("never");
    expect(headerOptions().title).toBe("Template");
  });

  it("opens a scheduled row on its cadence, titled as a repeat schedule", () => {
    renderWith(makeTemplate());

    expect(mockPickers["Repeats"].selectedValue).toBe("daily");
    expect(headerOptions().title).toBe("Repeat Schedule");
  });

  // Day-of-month and month only mean something under a cadence.
  it("hides the cadence detail pickers on Never", () => {
    renderWith(makeTemplate({ schedule: null }));

    expect(mockPickers["Day of month"]).toBeUndefined();
    expect(mockPickers["Month"]).toBeUndefined();
  });

  // Setting Repeats to Never is what stops a repeat while keeping the template,
  // so the only destructive action left is deleting the row — and it reads the
  // same either way rather than masquerading as "Stop Repeating".
  it("offers one Delete Template action whether or not the row has a schedule", () => {
    const template = renderWith(makeTemplate({ schedule: null }));
    expect(template.getByText("Delete Template")).toBeTruthy();
    expect(template.queryByText("Stop Repeating")).toBe(null);

    const repeat = renderWith(makeTemplate());
    expect(repeat.getByText("Delete Template")).toBeTruthy();
    expect(repeat.queryByText("Stop Repeating")).toBe(null);
  });

  // The copy has to follow the picker, not the saved row, or a user switching
  // to Never would still be told they are editing a repeat.
  it("re-titles the screen the moment the frequency changes", () => {
    renderWith(makeTemplate());
    expect(headerOptions().title).toBe("Repeat Schedule");

    act(() => mockPickers["Repeats"].onValueChange("never"));

    expect(headerOptions().title).toBe("Template");
  });
});
