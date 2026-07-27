import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ReactNode } from "react";

import { ETaskPriority, ETaskStatus, TTask, updateTask } from "@/api/tasks";
import { createTemplate, getTemplates, TTemplate } from "@/api/templates";

import { useTemplates } from "../useTemplates";

// useTemplates imports the supabase client from useAuth, which reads the app's
// URI scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/api/templates", () => ({
  ...jest.requireActual<typeof import("@/api/templates")>("@/api/templates"),
  getTemplates: jest.fn(),
  createTemplate: jest.fn(),
}));
jest.mock("@/api/tasks", () => ({
  ...jest.requireActual<typeof import("@/api/tasks")>("@/api/tasks"),
  updateTask: jest.fn(),
}));

const mockGetTemplates = getTemplates as jest.MockedFunction<
  typeof getTemplates
>;
const mockCreateTemplate = createTemplate as jest.MockedFunction<
  typeof createTemplate
>;
const mockUpdateTask = updateTask as jest.MockedFunction<typeof updateTask>;

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
    });
  });
});
