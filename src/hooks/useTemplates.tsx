import {
  UseMutateFunction,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { updateTask, TTask } from "@/api/tasks";
import {
  createTemplate,
  deleteTemplate,
  getTemplates,
  TCreateTemplate,
  TTemplate,
  TUpdateTemplate,
  updateTemplate,
} from "@/api/templates";
import { buildSchedule } from "@/utils/repeatSchedule";

import { supabase } from "./useAuth";

type TMutateCallbacks = {
  onError?: (error: Error) => void;
  onSuccess?: () => void;
};

type TUseTemplates = [
  TTemplate[],
  {
    createTemplate: (template: TCreateTemplate) => void;
    createTemplateFromTask: UseMutateFunction<TTemplate, Error, TTask>;
    deleteTemplate: (id: string, callbacks?: TMutateCallbacks) => void;
    getTemplateById: (id: string | null) => TTemplate | undefined;
    isLoading: boolean;
    saveTaskAsTemplate: UseMutateFunction<TTemplate, Error, TTask>;
    updateTemplate: (
      template: TUpdateTemplate,
      callbacks?: TMutateCallbacks,
    ) => void;
  },
];

/**
 * The task's shape, minus everything that belongs to a single occurrence — its
 * dates and its progress. Shared by the two "make a template out of this task"
 * mutations below, which differ only in whether they attach a schedule.
 */
const templateFieldsFromTask = (task: TTask) => ({
  alarmTime: task.alarmTime,
  goalId: task.goalId,
  listId: task.listId,
  priority: task.priority,
  title: task.title,
  // Carry the checklist's titles across, dropping each item's status — the
  // template is the blueprint every future occurrence starts from, so it
  // records *what* the steps are, not how far this one task got.
  subtasks: task.subtasks.map(({ id, title }) => ({ id, title })),
});

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

  const { mutate: create } = useMutation<TTemplate, Error, TCreateTemplate>({
    mutationFn: (template) => createTemplate(supabase, template),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });

  // Seed the new template into the cache synchronously. Both flows navigate
  // straight to the editor by id, which reads it from cache before the
  // invalidation refetch resolves — without this it would find nothing and
  // redirect back to the list.
  const seedTemplate = (template: TTemplate) => {
    queryClient.setQueryData<TTemplate[]>(["templates"], (existing = []) => [
      ...existing,
      template,
    ]);
    void queryClient.invalidateQueries({ queryKey: ["templates"] });
    void queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  const { mutate: createFromTask } = useMutation<TTemplate, Error, TTask>({
    mutationFn: async (task) => {
      const template = await createTemplate(supabase, {
        ...templateFieldsFromTask(task),
        // Explicit since DEX-65 dropped the column's daily-cron default: this
        // is the "Repeat" flow, so the row must carry a schedule or it would
        // land as a task template instead.
        schedule: buildSchedule({ frequency: "daily" }),
      });

      await updateTask(supabase, { id: task.id, templateId: template.id });

      return template;
    },
    onSuccess: seedTemplate,
  });

  const { mutate: saveAsTemplate } = useMutation<TTemplate, Error, TTask>({
    mutationFn: (task) =>
      createTemplate(supabase, {
        ...templateFieldsFromTask(task),
        schedule: null,
      }),
    // Deliberately no `updateTask({ templateId })`, unlike the repeat flow
    // above. Linking would make the source task look like it repeats to
    // `MoreMenu` and would let the mcp-server's `delete_task` take the template
    // down with it — saving a template must leave the task it came from alone.
    onSuccess: seedTemplate,
  });

  const { mutate: update } = useMutation<TTemplate, Error, TUpdateTemplate>({
    mutationFn: (diff) => updateTemplate(supabase, diff),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["templates"] });
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
      createTemplateFromTask: createFromTask,
      deleteTemplate: remove,
      getTemplateById,
      isLoading: isPending,
      saveTaskAsTemplate: saveAsTemplate,
      updateTemplate: update,
    },
  ];
};
