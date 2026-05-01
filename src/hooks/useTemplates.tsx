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

type TUseTemplates = [
  TTemplate[],
  {
    createTemplate: (template: TCreateTemplate) => void;
    createTemplateFromTask: UseMutateFunction<TTemplate, Error, TTask>;
    deleteTemplate: (id: string) => void;
    updateTemplate: (template: TUpdateTemplate) => void;
  },
];

type TUseTemplatesOptions = {
  skipQuery?: boolean;
};

export const useTemplates = (options?: TUseTemplatesOptions): TUseTemplates => {
  const queryClient = useQueryClient();

  const { data: templates = [] } = useQuery({
    enabled: !options?.skipQuery,
    queryKey: ["templates"],
    queryFn: () => getTemplates(supabase),
    staleTime: 1000 * 60 * 10,
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
        goalId: task.goalId,
        listId: task.listId,
        priority: task.priority,
        title: task.title,
      });

      await updateTask(supabase, { id: task.id, templateId: template.id });

      return template;
    },
    onSuccess: () => {
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

  return [
    templates,
    {
      createTemplate: create,
      createTemplateFromTask: createFromTask,
      deleteTemplate: remove,
      updateTemplate: update,
    },
  ];
};
