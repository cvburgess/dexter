import { Temporal } from "@js-temporal/polyfill";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createTask, hasTaskForTemplate, updateTask } from "@/api/tasks";
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
   * (it is not already an occurrence of another repeat). It is linked to the new
   * row only if that row ends up carrying a schedule — recurrence spawns from
   * *completing a linked task*, so a repeat needs the link to ever fire, while a
   * plain template must leave the task it came from alone.
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
 * Gives a template that has just gained a schedule its first occurrence, unless
 * some task already links to it.
 *
 * A schedule on its own generates nothing: recurrence spawns from *completing a
 * task whose `template_id` points at a scheduled row*, so a template promoted
 * to a repeat with no occurrence would sit under "Repeat tasks" describing a
 * cadence it could never act on. Creating from a draft links the source task
 * instead where that task is free to be linked, and a row that already has
 * occurrences keeps recurring from them.
 *
 * Counts today, so promoting to a cadence that matches today produces a task
 * now rather than looking like nothing happened.
 */
const seedFirstOccurrence = async (template: TTemplate): Promise<void> => {
  if (!template.schedule) return;
  if (await hasTaskForTemplate(supabase, template.id)) return;

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

        // Gated on the schedule, not on which menu item started the draft: a
        // scheduled row is a repeat and needs the link to ever fire, and a
        // scheduleless one is a saved template that must not make its source task
        // look like it repeats.
        if (linkTaskId && created.schedule) {
          await updateTask(supabase, {
            id: linkTaskId,
            templateId: created.id,
          });
        } else {
          // No task to fire from — give a scheduled row its own first
          // occurrence, the same guarantee `updateTemplate` makes. A no-op for
          // a scheduleless row, which is the ordinary "Save as template" case.
          await seedFirstOccurrence(created);
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
      await seedFirstOccurrence(template);
      return template;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["templates"] });
      // `seedFirstOccurrence` may have written one.
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
      deleteTemplate: remove,
      getTemplateById,
      isLoading: isPending,
      updateTemplate: update,
    },
  ];
};
