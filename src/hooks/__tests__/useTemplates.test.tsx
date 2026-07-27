import { Temporal } from "@js-temporal/polyfill";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ReactNode } from "react";

import {
  createTask,
  ETaskPriority,
  ETaskStatus,
  hasTaskForTemplate,
  TTask,
  updateTask,
} from "@/api/tasks";
import {
  createTemplate,
  getTemplates,
  TTemplate,
  updateTemplate,
} from "@/api/templates";

import { useTemplates } from "../useTemplates";

// useTemplates imports the supabase client from useAuth, which reads the app's
// URI scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/api/templates", () => ({
  ...jest.requireActual<typeof import("@/api/templates")>("@/api/templates"),
  getTemplates: jest.fn(),
  createTemplate: jest.fn(),
  updateTemplate: jest.fn(),
}));
jest.mock("@/api/tasks", () => ({
  ...jest.requireActual<typeof import("@/api/tasks")>("@/api/tasks"),
  updateTask: jest.fn(),
  createTask: jest.fn(),
  hasTaskForTemplate: jest.fn(),
}));

const mockGetTemplates = getTemplates as jest.MockedFunction<
  typeof getTemplates
>;
const mockCreateTemplate = createTemplate as jest.MockedFunction<
  typeof createTemplate
>;
const mockUpdateTask = updateTask as jest.MockedFunction<typeof updateTask>;
const mockCreateTask = createTask as jest.MockedFunction<typeof createTask>;
const mockHasTaskForTemplate = hasTaskForTemplate as jest.MockedFunction<
  typeof hasTaskForTemplate
>;
const mockUpdateTemplate = updateTemplate as jest.MockedFunction<
  typeof updateTemplate
>;

const task: TTask = {
  id: "task-1",
  alarmTime: "08:00",
  title: "Trip packing",
  dueOn: "2026-08-01",
  goalId: "goal-1",
  listId: "list-1",
  priority: ETaskPriority.IMPORTANT,
  scheduledFor: "2026-07-26",
  status: ETaskStatus.IN_PROGRESS,
  subtasks: [{ id: "sub-1", title: "Passport", status: ETaskStatus.DONE }],
  templateId: null,
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
};

const renderUseTemplates = async () => {
  const view = renderHook(() => useTemplates(), { wrapper: createWrapper() });
  await waitFor(() => expect(view.result.current[1].isLoading).toBe(false));
  return view;
};

describe("useTemplates", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTemplates.mockResolvedValue([]);
    mockCreateTemplate.mockResolvedValue({
      id: "template-1",
    } as unknown as TTemplate);
    mockUpdateTask.mockResolvedValue({} as never);
    mockCreateTask.mockResolvedValue({} as never);
    mockHasTaskForTemplate.mockResolvedValue(false);
  });

  // A schedule generates nothing on its own — recurrence spawns from completing
  // a task that links to the template. Promoting a saved template to a repeat
  // therefore has to leave an occurrence behind, or the row would sit under
  // "Repeat tasks" describing a cadence it can never act on.
  describe("updateTemplate seeding the first occurrence", () => {
    const promote = async (schedule: string | null) => {
      mockUpdateTemplate.mockResolvedValue({
        id: "template-1",
        title: "Trip packing",
        alarmTime: null,
        priority: ETaskPriority.IMPORTANT,
        listId: "list-1",
        goalId: null,
        subtasks: [{ id: "sub-1", title: "Passport" }],
        schedule,
      } as TTemplate);
      const view = await renderUseTemplates();

      act(() => {
        view.result.current[1].updateTemplate({ id: "template-1", schedule });
      });

      await waitFor(() => expect(mockUpdateTemplate).toHaveBeenCalled());
    };

    it("creates one when a template gains a cadence and has no task", async () => {
      await promote("0 0 * * *");

      await waitFor(() => expect(mockCreateTask).toHaveBeenCalled());
      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          title: "Trip packing",
          templateId: "template-1",
          status: ETaskStatus.TODO,
          // Daily counts today, so promoting produces something actionable now.
          scheduledFor: Temporal.Now.plainDateISO().toString(),
          // Its own copy of the checklist, freshly keyed and open.
          subtasks: [
            {
              id: expect.any(String),
              title: "Passport",
              status: ETaskStatus.TODO,
            },
          ],
        }),
      );
    });

    it("leaves an already-occurring repeat alone", async () => {
      mockHasTaskForTemplate.mockResolvedValue(true);

      await promote("0 0 * * *");

      expect(mockCreateTask).not.toHaveBeenCalled();
    });

    it("creates nothing when the row has no cadence", async () => {
      await promote(null);

      expect(mockHasTaskForTemplate).not.toHaveBeenCalled();
      expect(mockCreateTask).not.toHaveBeenCalled();
    });
  });

  // Whether the source task gets linked is decided by the saved row, not by
  // which menu item opened the draft: recurrence spawns from *completing a
  // linked task*, so a repeat needs the link to ever fire — while a plain
  // template must leave the task it came from alone, or that task would read as
  // repeating and `delete_task` would take the template down with it.
  describe("createTemplate", () => {
    it("links the source task when the new row carries a schedule", async () => {
      mockCreateTemplate.mockResolvedValue({
        id: "template-1",
        schedule: "0 0 * * *",
      } as TTemplate);
      const view = await renderUseTemplates();

      act(() => {
        view.result.current[1].createTemplate({
          template: { title: "Water the plants", priority: task.priority },
          linkTaskId: task.id,
        });
      });

      await waitFor(() =>
        expect(mockUpdateTask).toHaveBeenCalledWith(expect.anything(), {
          id: "task-1",
          templateId: "template-1",
        }),
      );
    });

    it("leaves the source task alone when the new row has no schedule", async () => {
      mockCreateTemplate.mockResolvedValue({
        id: "template-1",
        schedule: null,
      } as TTemplate);
      const view = await renderUseTemplates();

      act(() => {
        view.result.current[1].createTemplate({
          template: { title: "Trip packing", priority: task.priority },
          linkTaskId: task.id,
        });
      });

      await waitFor(() => expect(mockCreateTemplate).toHaveBeenCalled());
      expect(mockUpdateTask).not.toHaveBeenCalled();
      expect(mockCreateTask).not.toHaveBeenCalled();
    });

    // The caller withholds `linkTaskId` when the source task already belongs to
    // another repeat, since re-pointing it would strand *that* schedule. The new
    // row still needs something to fire from, so it gets its own occurrence.
    it("seeds an occurrence for a scheduled row with no task to link", async () => {
      mockCreateTemplate.mockResolvedValue({
        id: "template-1",
        title: "Water the plants",
        alarmTime: null,
        priority: ETaskPriority.IMPORTANT,
        listId: null,
        goalId: null,
        subtasks: [],
        schedule: "0 0 * * *",
      } as unknown as TTemplate);
      const view = await renderUseTemplates();

      act(() => {
        view.result.current[1].createTemplate({
          template: { title: "Water the plants", priority: task.priority },
        });
      });

      await waitFor(() =>
        expect(mockCreateTask).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            templateId: "template-1",
            scheduledFor: Temporal.Now.plainDateISO().toString(),
          }),
        ),
      );
      expect(mockUpdateTask).not.toHaveBeenCalled();
    });
  });
});
