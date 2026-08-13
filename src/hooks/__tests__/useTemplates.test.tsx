import { Temporal } from "@js-temporal/polyfill";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ReactNode } from "react";

import {
  createTask,
  ETaskPriority,
  ETaskStatus,
  hasOpenTaskForTemplate,
  TTask,
  updateTask,
} from "@/api/tasks";
import {
  createTemplate,
  getTemplates,
  TTemplate,
  updateTemplate,
} from "@/api/templates";
import { settleQueries } from "@/testUtils/settleQueries";

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
  hasOpenTaskForTemplate: jest.fn(),
}));

const mockGetTemplates = getTemplates as jest.MockedFunction<
  typeof getTemplates
>;
const mockCreateTemplate = createTemplate as jest.MockedFunction<
  typeof createTemplate
>;
const mockUpdateTask = updateTask as jest.MockedFunction<typeof updateTask>;
const mockCreateTask = createTask as jest.MockedFunction<typeof createTask>;
const mockHasOpenTaskForTemplate =
  hasOpenTaskForTemplate as jest.MockedFunction<typeof hasOpenTaskForTemplate>;
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
  url: null,
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    /** These mutations invalidate on success; close on the refetch that
     * follows, not on the mock call that says it started. */
    settled: () => settleQueries(queryClient),
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
};

const renderUseTemplates = async () => {
  const { settled, wrapper } = createWrapper();
  const view = renderHook(() => useTemplates(), { wrapper });
  await waitFor(() => expect(view.result.current[1].isLoading).toBe(false));
  return { ...view, settled };
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
    mockHasOpenTaskForTemplate.mockResolvedValue(false);
  });

  // `isLoading` is `isPending`, which drops to `false` on error while
  // `templates` falls back to `[]` — so without `isError` a failed fetch looks
  // exactly like a deleted template to the editor screen (DEX-100).
  it("reports a failed fetch rather than an empty template list", async () => {
    mockGetTemplates.mockRejectedValue(new Error("network error"));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTemplates(), { wrapper });

    await waitFor(() => expect(result.current[1].isError).toBe(true));
    expect(result.current[0]).toEqual([]);
    expect(result.current[1].isLoading).toBe(false);
  });

  it("recovers from a failed fetch on refetch", async () => {
    mockGetTemplates.mockRejectedValueOnce(new Error("network error"));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTemplates(), { wrapper });
    await waitFor(() => expect(result.current[1].isError).toBe(true));

    const template = { id: "template-1", title: "Water the plants" };
    mockGetTemplates.mockResolvedValue([template as TTemplate]);
    act(() => result.current[1].refetch());

    await waitFor(() =>
      expect(result.current[1].getTemplateById("template-1")).toEqual(template),
    );
    expect(result.current[1].isError).toBe(false);
  });

  // A repeat has exactly one open task. A schedule generates nothing on its own
  // — recurrence spawns from completing a task that links to the template — so
  // promoting a saved template to a repeat has to leave an open occurrence
  // behind, or the row would sit under "Repeat tasks" describing a cadence it
  // can never act on.
  describe("updateTemplate seeding the next occurrence", () => {
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
      await view.settled();
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

    it("leaves a repeat with an open occurrence alone", async () => {
      mockHasOpenTaskForTemplate.mockResolvedValue(true);

      await promote("0 0 * * *");

      expect(mockCreateTask).not.toHaveBeenCalled();
    });

    it("creates nothing when the row has no cadence", async () => {
      await promote(null);

      expect(mockHasOpenTaskForTemplate).not.toHaveBeenCalled();
      expect(mockCreateTask).not.toHaveBeenCalled();
    });
  });

  // `tasks.template_id` means "this task came from that template", which is
  // simply true of the task a draft was seeded from — whatever cadence it ends
  // up saved on. So the link is recorded unconditionally; whether anything
  // recurs from it is the template's schedule's business, read at completion
  // time.
  describe("createTemplate", () => {
    it.each([["0 0 * * *"], [null]])(
      "links the source task for a row saved with schedule %p",
      async (schedule) => {
        mockCreateTemplate.mockResolvedValue({
          id: "template-1",
          schedule,
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
        // The linked task is the occurrence — no second one is seeded.
        expect(mockCreateTask).not.toHaveBeenCalled();
      },
    );

    // The caller withholds `linkTaskId` when the source task already came from a
    // template, since a task has one `template_id` and re-pointing it would
    // rewrite where it came from. The new row still needs something to fire
    // from, so it gets its own occurrence.
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

  // The repair button behind a stalled repeat in Settings → Tasks. It runs the
  // very code path the auto-seed does, guards included, so the fix can't drift
  // from what was supposed to have prevented the problem.
  describe("createNextOccurrence", () => {
    const repeat = {
      id: "template-1",
      title: "Water the plants",
      alarmTime: null,
      priority: ETaskPriority.IMPORTANT,
      listId: null,
      goalId: null,
      subtasks: [{ id: "sub-1", title: "Fill the can" }],
      schedule: "0 0 * * *",
    } as unknown as TTemplate;

    const createNext = async (template: TTemplate) => {
      const view = await renderUseTemplates();
      act(() => {
        view.result.current[1].createNextOccurrence(template);
      });
      await view.settled();
    };

    it("creates the repeat's next open task", async () => {
      await createNext(repeat);

      await waitFor(() =>
        expect(mockCreateTask).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            title: "Water the plants",
            templateId: "template-1",
            status: ETaskStatus.TODO,
            // Counts today, so a daily repeat is actionable straight away.
            scheduledFor: Temporal.Now.plainDateISO().toString(),
            subtasks: [
              {
                id: expect.any(String),
                title: "Fill the can",
                status: ETaskStatus.TODO,
              },
            ],
          }),
        ),
      );
    });

    // Idempotent: a second tap, or a tap on a repeat that isn't actually
    // stalled, must not open a parallel chain.
    it("creates nothing when the repeat already has an open task", async () => {
      mockHasOpenTaskForTemplate.mockResolvedValue(true);

      await createNext(repeat);

      await waitFor(() =>
        expect(mockHasOpenTaskForTemplate).toHaveBeenCalled(),
      );
      expect(mockCreateTask).not.toHaveBeenCalled();
    });

    it("creates nothing for a scheduleless task template", async () => {
      await createNext({ ...repeat, schedule: null });

      await waitFor(() => expect(mockGetTemplates).toHaveBeenCalled());
      expect(mockHasOpenTaskForTemplate).not.toHaveBeenCalled();
      expect(mockCreateTask).not.toHaveBeenCalled();
    });
  });
});
