import { act, renderHook } from "@testing-library/react-native";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import { TTemplate } from "@/api/templates";
import { useTasks } from "@/hooks/useTasks";
import { useTemplates } from "@/hooks/useTemplates";

import { useTaskDelete } from "../useTaskDelete";

// useTasks imports the supabase client from useAuth, which reads the app's URI
// scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/hooks/useTasks", () => ({
  ...jest.requireActual<typeof import("@/hooks/useTasks")>("@/hooks/useTasks"),
  useTasks: jest.fn(),
}));
jest.mock("@/hooks/useTemplates", () => ({ useTemplates: jest.fn() }));

const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;
const mockUseTemplates = useTemplates as jest.MockedFunction<
  typeof useTemplates
>;
const mockDeleteTask = jest.fn();
const mockDeleteTemplate = jest.fn();

const task = (overrides: Partial<TTask> = {}): TTask => ({
  id: "task-1",
  alarmTime: null,
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.UNPRIORITIZED,
  scheduledFor: "2026-08-09",
  status: ETaskStatus.TODO,
  subtasks: [],
  templateId: null,
  title: "Write report",
  url: null,
  ...overrides,
});

/** A repeat schedule (has a cron) or a saved task template (has none) — DEX-65. */
const template = (schedule: string | null): TTemplate =>
  ({ id: "template-1", schedule }) as TTemplate;

/** Seeds the template the task's `templateId` resolves to; `null` = unknown. */
const setup = (linked: TTemplate | null) => {
  mockUseTasks.mockReturnValue([[], { deleteTask: mockDeleteTask }] as never);
  mockUseTemplates.mockReturnValue([
    [],
    {
      deleteTemplate: mockDeleteTemplate,
      getTemplateById: () => linked ?? undefined,
    },
  ] as never);
  return renderHook(() => useTaskDelete());
};

/** Answers the open prompt by pressing one of its buttons. */
const press = (
  result: { current: ReturnType<typeof useTaskDelete> },
  label: string,
) => {
  const action = result.current.confirmationProps.actions?.find(
    (candidate) => candidate.label === label,
  );
  if (!action) throw new Error(`No confirmation action labelled "${label}"`);
  return act(async () => {
    await action.onPress?.();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useTaskDelete", () => {
  it("deletes a plain task once confirmed, touching no template", async () => {
    const { result } = setup(null);

    act(() => void result.current.confirmDelete(task()));
    expect(result.current.confirmationProps.title).toBe("Delete Task");

    await press(result, "Delete");

    expect(mockDeleteTask).toHaveBeenCalledWith("task-1");
    expect(mockDeleteTemplate).not.toHaveBeenCalled();
  });

  it("leaves the task alone when cancelled", async () => {
    const { result } = setup(null);

    act(() => void result.current.confirmDelete(task()));
    await press(result, "Cancel");

    expect(mockDeleteTask).not.toHaveBeenCalled();
  });

  // The task→template FK is ON DELETE SET NULL, so the schedule has to go
  // explicitly or the task reappears tomorrow (DEX-21).
  it("removes a repeating task's schedule alongside it", async () => {
    const { result } = setup(template("0 0 * * *"));

    act(
      () =>
        void result.current.confirmDelete(task({ templateId: "template-1" })),
    );
    expect(result.current.confirmationProps.title).toBe(
      "Delete repeating task?",
    );

    await press(result, "Delete");

    expect(mockDeleteTemplate).toHaveBeenCalledWith("template-1");
    expect(mockDeleteTask).toHaveBeenCalledWith("task-1");
  });

  // A template without a schedule is one the user saved for themselves
  // (DEX-65); it is not this task's, and must outlive it.
  it("spares a saved task template", async () => {
    const { result } = setup(template(null));

    act(
      () =>
        void result.current.confirmDelete(task({ templateId: "template-1" })),
    );
    await press(result, "Delete");

    expect(mockDeleteTemplate).not.toHaveBeenCalled();
    expect(mockDeleteTask).toHaveBeenCalledWith("task-1");
  });

  // Unknown — still loading, or a stale id — counts as "not a repeat": leaving
  // a schedule behind is visible and undoable in Settings, where deleting a
  // template the user saved is neither.
  it("keeps an unresolvable template rather than guessing", async () => {
    const { result } = setup(null);

    act(
      () =>
        void result.current.confirmDelete(task({ templateId: "template-1" })),
    );
    expect(result.current.confirmationProps.title).toBe("Delete Task");

    await press(result, "Delete");

    expect(mockDeleteTemplate).not.toHaveBeenCalled();
  });
});
