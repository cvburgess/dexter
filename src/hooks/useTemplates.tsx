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
    updateTemplate: (
      template: TUpdateTemplate,
      callbacks?: TMutateCallbacks,
    ) => void;
  },
];

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

  const { mutate: createFromTask } = useMutation<TTemplate, Error, TTask>({
    mutationFn: async (task) => {
      const template = await createTemplate(supabase, {
        alarmTime: task.alarmTime,
        goalId: task.goalId,
        listId: task.listId,
        priority: task.priority,
        title: task.title,
        // Carry the checklist's titles across, dropping each item's status —
        // the template is the blueprint every future occurrence starts from,
        // so it records *what* the steps are, not how far this one task got.
        subtasks: task.subtasks.map(({ id, title }) => ({ id, title })),
      });

      await updateTask(supabase, { id: task.id, templateId: template.id });

      return template;
    },
    onSuccess: (template) => {
      // Seed the new template into the cache synchronously. The "Repeat" flow
      // navigates straight to the editor by id, which reads it from cache before
      // the invalidation refetch resolves — without this it would find nothing
      // and redirect back to the list.
      queryClient.setQueryData<TTemplate[]>(["templates"], (existing = []) => [
        ...existing,
        template,
      ]);
      void queryClient.invalidateQueries({ queryKey: ["templates"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
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
      updateTemplate: update,
    },
  ];
};
