import { Temporal } from "@js-temporal/polyfill";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createTask, hasOpenTaskForTemplate, updateTask } from "@/api/tasks";
import {
  createTemplate,
  deleteTemplate,
  getTemplates,
  TCreateTemplate,
  TTemplate,
  TUpdateTemplate,
  updateTemplate,
} from "@/api/templates";
import { getFirstOccurrence } from "@/utils/repeatSchedule";
import { subtasksFromTemplate } from "@/utils/subtasks";
import { ETaskStatus } from "@/utils/taskStatus";

import { supabase } from "./useAuth";

type TMutateCallbacks = {
  onError?: (error: Error) => void;
  onSuccess?: () => void;
};

export type TCreateTemplateVars = {
  template: TCreateTemplate;
  /**
   * The task the template was drafted from, if that task is free to be linked
   * (it does not already belong to a template). It is linked unconditionally:
   * `tasks.template_id` means "this task came from that template", which is
   * simply true here whether or not the new row carries a schedule. Whether the
   * task recurs is a property of the template, read at completion time.
   */
  linkTaskId?: string;
};

type TUseTemplates = [
  TTemplate[],
  {
    createTemplate: (
      vars: TCreateTemplateVars,
      callbacks?: TMutateCallbacks,
    ) => void;
    /**
     * Gives a repeat its next open task — the manual half of the one-open-task
     * invariant, for a repeat that has run dry. A no-op for a scheduleless row
     * or one that still has an open task.
     */
    createNextOccurrence: (
      template: TTemplate,
      callbacks?: TMutateCallbacks,
    ) => void;
    deleteTemplate: (id: string, callbacks?: TMutateCallbacks) => void;
    getTemplateById: (id: string | null) => TTemplate | undefined;
    isLoading: boolean;
    updateTemplate: (
      template: TUpdateTemplate,
      callbacks?: TMutateCallbacks,
    ) => void;
  },
];

/**
 * Gives a repeat its one open task, unless it already has one.
 *
 * **A repeat has exactly one open task.** A schedule on its own generates
 * nothing: recurrence spawns from *completing a task whose `template_id` points
 * at a scheduled row*, so a repeat with no open task sits under "Repeat tasks"
 * describing a cadence it can never act on. This is the one code path that
 * fixes that, whether it runs automatically when a row gains a cadence or from
 * the repair button on a stalled row in Settings.
 *
 * Counts today, so a cadence that matches today produces a task now rather than
 * looking like nothing happened.
 */
const seedNextOccurrence = async (template: TTemplate): Promise<void> => {
  if (!template.schedule) return;
  if (await hasOpenTaskForTemplate(supabase, template.id)) return;

  const scheduledFor = getFirstOccurrence(
    template.schedule,
    Temporal.Now.plainDateISO().toString(),
  );
  if (!scheduledFor) return;

  await createTask(supabase, {
    title: template.title,
    alarmTime: template.alarmTime,
    priority: template.priority,
    listId: template.listId,
    goalId: template.goalId,
    scheduledFor,
    templateId: template.id,
    status: ETaskStatus.TODO,
    subtasks: subtasksFromTemplate(template.subtasks, ETaskStatus.TODO),
  });
};

type TUseTemplatesOptions = {
  skipQuery?: boolean;
};

export const useTemplates = (options?: TUseTemplatesOptions): TUseTemplates => {
  const queryClient = useQueryClient();

  const { data: templates = [], isPending } = useQuery({
    enabled: !options?.skipQuery,
    queryKey: ["templates"],
    queryFn: () => getTemplates(supabase),
  });

  const { mutate: create } = useMutation<TTemplate, Error, TCreateTemplateVars>(
    {
      mutationFn: async ({ template, linkTaskId }) => {
        const created = await createTemplate(supabase, template);

        // The task this was drafted from did come from this template, whatever
        // cadence the draft was saved on — so record it. A scheduled row gets
        // the open task it needs to fire from for free; a scheduleless one just
        // records provenance, and nothing recurs until it gains a schedule.
        if (linkTaskId) {
          await updateTask(supabase, {
            id: linkTaskId,
            templateId: created.id,
          });
        } else {
          // No task to fire from — give a scheduled row its own first
          // occurrence, the same guarantee `updateTemplate` makes. A no-op for
          // a scheduleless row.
          await seedNextOccurrence(created);
        }

        return created;
      },
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["templates"] });
        void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      },
    },
  );

  const { mutate: update } = useMutation<TTemplate, Error, TUpdateTemplate>({
    mutationFn: async (diff) => {
      const template = await updateTemplate(supabase, diff);
      await seedNextOccurrence(template);
      return template;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["templates"] });
      // `seedNextOccurrence` may have written one.
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  // The repair button in Settings → Tasks, and literally the same code path the
  // auto-seed above takes — a stalled repeat is fixed by the thing that was
  // supposed to have prevented it.
  const { mutate: createNext } = useMutation<void, Error, TTemplate>({
    mutationFn: seedNextOccurrence,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const { mutate: remove } = useMutation<void, Error, string>({
    mutationFn: (id) => deleteTemplate(supabase, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });

  const getTemplateById = (id: string | null) => {
    if (!id) return undefined;
    return templates.find((template) => template.id === id);
  };

  return [
    templates,
    {
      createTemplate: create,
      createNextOccurrence: createNext,
      deleteTemplate: remove,
      getTemplateById,
      isLoading: isPending,
      updateTemplate: update,
    },
  ];
};
