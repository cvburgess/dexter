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
  /** The task the template was drafted from, if free to link (no template yet).
   * Linked unconditionally — whether it recurs is read at completion time. */
  linkTaskId?: string;
};

type TUseTemplates = [
  TTemplate[],
  {
    createTemplate: (
      vars: TCreateTemplateVars,
      callbacks?: TMutateCallbacks,
    ) => void;
    /** Gives a repeat its next open task if it has run dry — a no-op for a
     * scheduleless row or one that still has an open task. */
    createNextOccurrence: (
      template: TTemplate,
      callbacks?: TMutateCallbacks,
    ) => void;
    deleteTemplate: (id: string, callbacks?: TMutateCallbacks) => void;
    getTemplateById: (id: string | null) => TTemplate | undefined;
    /** Distinct from an empty result: isLoading drops false on error too, so
     * without this a failed fetch reads as a deleted template (DEX-100). */
    isError: boolean;
    isLoading: boolean;
    /** Re-runs the fetch; the retry behind a failed load. */
    refetch: () => void;
    updateTemplate: (
      template: TUpdateTemplate,
      callbacks?: TMutateCallbacks,
    ) => void;
  },
];

/** Gives a repeat its one open task, unless it already has one — a schedule
 * alone generates nothing since recurrence spawns from completion. */
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
    subtasks: subtasksFromTemplate(template.subtasks),
  });
};

/** Best-effort: a repair, not part of the save — letting it reject would
 * report a successful save as a failure. */
const trySeedNextOccurrence = async (template: TTemplate): Promise<void> => {
  try {
    await seedNextOccurrence(template);
  } catch {
    // Swallowed on purpose — see above.
  }
};

type TUseTemplatesOptions = {
  skipQuery?: boolean;
};

export const useTemplates = (options?: TUseTemplatesOptions): TUseTemplates => {
  const queryClient = useQueryClient();

  const {
    data: templates = [],
    isError,
    isPending,
    refetch,
  } = useQuery({
    enabled: !options?.skipQuery,
    queryKey: ["templates"],
    queryFn: () => getTemplates(supabase),
  });

  const { mutate: create } = useMutation<TTemplate, Error, TCreateTemplateVars>(
    {
      mutationFn: async ({ template, linkTaskId }) => {
        const created = await createTemplate(supabase, template);

        // Recorded regardless of cadence: a scheduled row gets the open task
        // it needs to fire from for free; a scheduleless one just records it.
        if (linkTaskId) {
          await updateTask(supabase, {
            id: linkTaskId,
            templateId: created.id,
          });
        } else {
          // No task to fire from — give a scheduled row its own first
          // occurrence, same guarantee updateTemplate makes.
          await trySeedNextOccurrence(created);
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
      await trySeedNextOccurrence(template);
      return template;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["templates"] });
      // `seedNextOccurrence` may have written one.
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  // The Settings → Tasks repair button — the same path the auto-seed above
  // takes, so a fix can't drift from the original prevention.
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
      isError,
      isLoading: isPending,
      // Swallows the promise so a caller can hand this straight to an
      // `onPress` — the result is already in `templates`/`isError`.
      refetch: () => void refetch(),
      updateTemplate: update,
    },
  ];
};
