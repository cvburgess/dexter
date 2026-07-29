import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ReactElement } from "react";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import { TTemplate } from "@/api/templates";
import RepeatScheduleScreen from "@/app/(app)/(tabs)/settings/tasks/[id]";
import { useTemplates } from "@/hooks/useTemplates";

// useTasks imports the supabase client from useAuth, which reads the app's URI
// scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/hooks/useTemplates", () => ({ useTemplates: jest.fn() }));
jest.mock("@/hooks/useLists", () => ({ useLists: () => [[], {}] }));
jest.mock("@/hooks/useGoals", () => ({ useGoals: () => [[], {}] }));

// The draft ("Save as template") path seeds itself from the task named by the
// route's `fromTask` param.
const mockTasks: { current: TTask[] } = { current: [] };
const mockTasksQuery = { isError: false, isLoading: false };
const mockRefetchTasks = jest.fn();
jest.mock("@/hooks/useTasks", () => ({
  useTasks: () => [
    mockTasks.current,
    { ...mockTasksQuery, refetch: mockRefetchTasks },
  ],
}));

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
  headerLeft: () => ReactElement;
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
const mockParams: { current: Record<string, string> } = {
  current: { id: "template-1" },
};
// Stands in for react-navigation's focus lifecycle: `DismissModal` only pops a
// focused screen, since `router.back()` acts on whichever navigator has focus.
jest.mock("expo-router", () => {
  const { useEffect } = require("react");
  return {
    useNavigation: () => mockNavigation,
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams.current,
    useFocusEffect: (effect: () => void | (() => void)) => {
      useEffect(() => effect(), [effect]);
    },
  };
});

const headerOptions = (): THeaderOptions =>
  mockNavigation.setOptions.mock.calls.at(-1)![0];

const mockUseTemplates = useTemplates as jest.MockedFunction<
  typeof useTemplates
>;
const mockCreateTemplate = jest.fn();
const mockUpdateTemplate = jest.fn();
const mockDeleteTemplate = jest.fn();
const mockRefetchTemplates = jest.fn();

const seedTask: TTask = {
  id: "task-1",
  alarmTime: "08:00",
  title: "Trip packing",
  dueOn: "2026-08-01",
  goalId: null,
  listId: "list-1",
  priority: ETaskPriority.IMPORTANT,
  scheduledFor: "2026-07-26",
  status: ETaskStatus.IN_PROGRESS,
  subtasks: [{ id: "sub-1", title: "Passport", status: ETaskStatus.DONE }],
  templateId: null,
};

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

const templatesResult = (
  templates: TTemplate[],
  { isError = false, isLoading = false } = {},
) =>
  mockUseTemplates.mockReturnValue([
    templates,
    {
      getTemplateById: (id: string | null) =>
        templates.find((template) => template.id === id),
      isError,
      isLoading,
      refetch: mockRefetchTemplates,
      createTemplate: mockCreateTemplate,
      createNextOccurrence: jest.fn(),
      updateTemplate: mockUpdateTemplate,
      deleteTemplate: mockDeleteTemplate,
    },
  ]);

const renderWith = (template: TTemplate) => {
  mockParams.current = { id: template.id };
  templatesResult([template]);
  return render(<RepeatScheduleScreen />);
};

/** The draft both menu items open: seeded from a task, nothing written yet. */
const renderDraftFrom = (
  task: TTask,
  extraParams: Record<string, string> = {},
) => {
  mockParams.current = { id: "new", fromTask: task.id, ...extraParams };
  mockTasks.current = [task];
  templatesResult([]);
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
    mockTasksQuery.isError = false;
    mockTasksQuery.isLoading = false;
    for (const key of Object.keys(mockPickers)) delete mockPickers[key];
  });

  // "Save as template" routes here before anything is written, so ✓ is what
  // creates the row and ✕ leaves nothing behind.
  describe("a draft seeded from a task", () => {
    it("writes nothing until saved", () => {
      renderDraftFrom(seedTask);

      expect(mockCreateTemplate).not.toHaveBeenCalled();
      expect(mockUpdateTemplate).not.toHaveBeenCalled();
    });

    it("abandons the draft when closed", () => {
      renderDraftFrom(seedTask);

      const header = render(headerOptions().headerLeft());
      fireEvent.press(header.getByTestId("modal-close-button"));

      expect(mockCreateTemplate).not.toHaveBeenCalled();
      expect(mockRouter.back).toHaveBeenCalled();
    });

    it("creates the template from the task's fields on save", () => {
      renderDraftFrom(seedTask);

      save();

      expect(mockUpdateTemplate).not.toHaveBeenCalled();
      expect(mockCreateTemplate).toHaveBeenCalledWith(
        {
          template: {
            title: "Trip packing",
            priority: ETaskPriority.IMPORTANT,
            listId: "list-1",
            goalId: null,
            alarmTime: "08:00",
            // A Save-as-template draft opens on Never.
            schedule: null,
            // The blueprint drops each item's status.
            subtasks: [{ id: "sub-1", title: "Passport" }],
          },
          // Passed either way; the hook links only if the row ends up scheduled.
          linkTaskId: "task-1",
        },
        expect.anything(),
      );
    });

    it("opens on Never with no delete action, since there is nothing to delete", () => {
      const screen = renderDraftFrom(seedTask);

      expect(mockPickers["Repeats"].selectedValue).toBe("never");
      expect(headerOptions().title).toBe("New Template");
      expect(screen.queryByText("Delete Template")).toBe(null);
    });

    // The only difference between the two menu items: Repeat starts the same
    // draft on a daily cadence rather than on Never.
    it("opens on Daily when Repeat started it, and saves that cron", () => {
      renderDraftFrom(seedTask, { repeats: "1" });

      expect(mockPickers["Repeats"].selectedValue).toBe("daily");

      save();

      expect(mockCreateTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          template: expect.objectContaining({ schedule: "0 0 * * *" }),
          linkTaskId: "task-1",
        }),
        expect.anything(),
      );
    });

    // A task that is already an occurrence of another repeat is not free to be
    // linked: re-pointing its `template_id` would leave that schedule with no
    // task to fire from, silently killing it. `useTemplates` seeds the new row
    // its own first occurrence instead.
    it("does not offer a task that already belongs to a repeat", () => {
      renderDraftFrom(
        { ...seedTask, templateId: "template-9" },
        {
          repeats: "1",
        },
      );

      save();

      expect(mockCreateTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ linkTaskId: undefined }),
        expect.anything(),
      );
    });
  });

  describe("closing", () => {
    // Popping, not navigating: the list is already underneath (the tasks stack
    // anchors it), and replacing it instead would collapse what sits under
    // *that*, leaving Tasks as the root of the settings tab with no back button.
    it("pops back to the template list after saving", () => {
      mockUpdateTemplate.mockImplementation((_diff, { onSuccess }) =>
        onSuccess(),
      );
      renderWith(makeTemplate());

      save();

      expect(mockRouter.back).toHaveBeenCalled();
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it("pops back to the template list after deleting", async () => {
      mockConfirm.mockResolvedValue(true);
      mockDeleteTemplate.mockImplementation((_id, { onSuccess }) =>
        onSuccess(),
      );
      const screen = renderWith(makeTemplate());

      fireEvent.press(screen.getByText("Delete Template"));
      await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    });

    // The one case the anchor can't cover: a cold deep link straight to this URL.
    it("falls back to the list when there is nothing to pop", () => {
      mockRouter.canGoBack.mockReturnValue(false);
      mockUpdateTemplate.mockImplementation((_diff, { onSuccess }) =>
        onSuccess(),
      );
      renderWith(makeTemplate());

      save();

      expect(mockRouter.back).not.toHaveBeenCalled();
      expect(mockRouter.replace).toHaveBeenCalledWith("/settings/tasks");
    });

    // The form owns the only header on web, and it doesn't render until the
    // template resolves — so before DEX-101 the wait was a bare spinner with no
    // way out but the backdrop (DEX-101).
    describe("while the template is still loading", () => {
      beforeEach(() => {
        mockParams.current = { id: "template-1" };
        templatesResult([], { isLoading: true });
      });

      it("still offers a working close button", () => {
        render(<RepeatScheduleScreen />);

        const close = render(headerOptions().headerLeft());
        fireEvent.press(close.getByTestId("modal-close-button"));

        expect(mockRouter.back).toHaveBeenCalledTimes(1);
        expect(mockUpdateTemplate).not.toHaveBeenCalled();
      });

      it("falls back to the list on a cold deep link", () => {
        mockRouter.canGoBack.mockReturnValue(false);
        render(<RepeatScheduleScreen />);

        const close = render(headerOptions().headerLeft());
        fireEvent.press(close.getByTestId("modal-close-button"));

        expect(mockRouter.back).not.toHaveBeenCalled();
        expect(mockRouter.replace).toHaveBeenCalledWith("/settings/tasks");
      });
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

  // Both bail-outs used to read `isLoading ? spinner : <Redirect />`, which
  // treats a failed fetch as a deleted row — `isLoading` is `false` in both
  // cases, so an offline open silently threw the user back to the list
  // (DEX-100).
  describe("when the record can't be resolved", () => {
    it("waits for the template fetch rather than closing", () => {
      mockParams.current = { id: "template-1" };
      templatesResult([], { isLoading: true });
      const screen = render(<RepeatScheduleScreen />);

      expect(mockRouter.back).not.toHaveBeenCalled();
      expect(mockRouter.replace).not.toHaveBeenCalled();
      // The spinner, not the form and not the error state. This used to assert
      // no header was wired at all, which DEX-101 inverted — the loading branch
      // now carries one so ✕ exists — so discriminate on the body instead.
      expect(screen.queryByTestId("modal-error-retry")).toBeNull();
      expect(mockPickers["Repeats"]).toBeUndefined();
    });

    it("dismisses once the template is known to be gone", () => {
      mockParams.current = { id: "template-1" };
      templatesResult([]);
      render(<RepeatScheduleScreen />);

      expect(mockRouter.back).toHaveBeenCalled();
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it("replaces to the list when a deleted template was deep-linked cold", () => {
      mockRouter.canGoBack.mockReturnValue(false);
      mockParams.current = { id: "template-1" };
      templatesResult([]);
      render(<RepeatScheduleScreen />);

      expect(mockRouter.replace).toHaveBeenCalledWith("/settings/tasks");
    });

    it("reports a failed template fetch and retries it", () => {
      mockParams.current = { id: "template-1" };
      templatesResult([], { isError: true });
      const screen = render(<RepeatScheduleScreen />);

      expect(
        screen.getByText(
          "Couldn't load your repeat schedules. Check your connection and try again.",
        ),
      ).toBeTruthy();
      expect(mockRouter.back).not.toHaveBeenCalled();

      fireEvent.press(screen.getByTestId("modal-error-retry"));
      expect(mockRefetchTemplates).toHaveBeenCalledTimes(1);
    });

    it("dismisses when the task a draft would seed from is gone", () => {
      mockParams.current = { id: "new", fromTask: "task-1" };
      mockTasks.current = [];
      templatesResult([]);
      render(<RepeatScheduleScreen />);

      expect(mockRouter.back).toHaveBeenCalled();
    });

    it("reports a failed tasks fetch on the draft path and retries it", () => {
      mockParams.current = { id: "new", fromTask: "task-1" };
      mockTasks.current = [];
      mockTasksQuery.isError = true;
      templatesResult([]);
      const screen = render(<RepeatScheduleScreen />);

      expect(
        screen.getByText(
          "Couldn't load your tasks. Check your connection and try again.",
        ),
      ).toBeTruthy();
      expect(mockRouter.back).not.toHaveBeenCalled();

      fireEvent.press(screen.getByTestId("modal-error-retry"));
      expect(mockRefetchTasks).toHaveBeenCalledTimes(1);
    });
  });
});
