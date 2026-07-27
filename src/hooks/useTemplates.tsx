import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { updateTask } from "@/api/tasks";
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

export type TCreateTemplateVars = {
  template: TCreateTemplate;
  /**
   * The task the template was drafted from. It is linked to the new row only if
   * that row ends up carrying a schedule — recurrence spawns from *completing a
   * linked task*, so a repeat needs the link to ever fire, while a plain
   * template must leave the task it came from alone.
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
      deleteTemplate: remove,
      getTemplateById,
      isLoading: isPending,
      updateTemplate: update,
    },
  ];
};
