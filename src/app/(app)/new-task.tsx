import { Href, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, Text } from "react-native";

import { isTaskTemplate } from "@/api/templates";
import { ModalScreen } from "@/components/ModalScreen";
import {
  SegmentedControl,
  TSegmentedControlOption,
} from "@/components/SegmentedControl";
import { TaskForm } from "@/components/TaskForm";
import { TemplatePicker } from "@/components/TemplatePicker";
import { WebModalHeader } from "@/components/WebModalHeader";
import { useDismissModal } from "@/hooks/useDismissModal";
import { useLists } from "@/hooks/useLists";
import { useModalHeaderActions } from "@/hooks/useModalHeaderActions";
import { useTaskForm } from "@/hooks/useTaskForm";
import { useTaskFormScroll } from "@/hooks/useTaskFormScroll";
import { useTasks } from "@/hooks/useTasks";
import { useTemplates } from "@/hooks/useTemplates";
import { showSaveError } from "@/utils/showSaveError";
import { useTheme } from "@/utils/theme";

/**
 * Where the task's starting point comes from: nothing, a saved template, or
 * (eventually) a spoken description. AI is a deliberate placeholder — the tab
 * exists so the shape of the modal is settled before the feature lands.
 */
type TNewTaskMode = "new" | "template" | "ai";

const MODE_OPTIONS: TSegmentedControlOption<TNewTaskMode>[] = [
  { value: "new", label: "New" },
  { value: "template", label: "Template" },
  { value: "ai", label: "AI" },
];

/** Where this modal returns to when it can't just pop — one value, because a
 * cold deep link and a ✕ have to land in the same place. */
const HOME: Href = "/";

export default function NewTaskScreen() {
  const theme = useTheme();
  const [lists, { isLoading: isLoadingLists }] = useLists();
  const [, { createTask }] = useTasks({ skipQuery: true });
  const [allTemplates, { isLoading: isLoadingTemplates }] = useTemplates();
  // `scheduledFor` is set by NewTaskButton to the day the user was viewing
  // (absent → today); `url` by `ShareIntentRedirect`, to the link that was
  // shared into the app from another app's share sheet (DEX-66).
  const { scheduledFor, url } = useLocalSearchParams<{
    scheduledFor?: string;
    url?: string;
  }>();
  const form = useTaskForm(lists, {
    defaultScheduledFor: scheduledFor,
    defaultUrl: url,
  });
  const [mode, setMode] = useState<TNewTaskMode>("new");
  const hasSaved = useRef(false);
  const { scrollViewProps, scrollToEndOnNextLayout } = useTaskFormScroll();

  // Repeat tasks share the templates table; only the scheduleless rows are
  // blueprints a new task can start from.
  const templates = allTemplates.filter(isTaskTemplate);

  // Saving waits for lists so `#list` tokens in the title can resolve, and
  // is one-shot so a double tap can't create duplicate tasks. The AI tab has no
  // form behind it yet, so there is nothing there to save.
  const canSave = form.canSave && !isLoadingLists && mode !== "ai";

  const handleClose = useDismissModal(HOME);

  const handleSave = () => {
    if (hasSaved.current || !canSave) return;
    hasSaved.current = true;
    createTask(form.task, {
      onSuccess: handleClose,
      onError: () => {
        hasSaved.current = false;
        showSaveError("task");
      },
    });
  };

  useModalHeaderActions({ canSave, onClose: handleClose, onSave: handleSave });

  return (
    <ModalScreen>
      <WebModalHeader
        isDisabled={!canSave}
        onClose={handleClose}
        onSave={handleSave}
      />
      <ScrollView {...scrollViewProps}>
        <SegmentedControl
          options={MODE_OPTIONS}
          testIDPrefix="new-task-mode"
          value={mode}
          onChange={setMode}
        />

        {/* Selecting is not saving: the template seeds the form below and the
            user can still edit anything before the task is created. The form
            holds the selection, so the outlined card and the task's
            `template_id` can never disagree. */}
        {mode === "template" && (
          <TemplatePicker
            templates={templates}
            selectedId={form.templateId}
            isLoading={isLoadingTemplates}
            onSelect={form.applyTemplate}
          />
        )}

        {mode === "ai" ? (
          <Text
            style={[
              theme.fonts.body,
              { paddingVertical: theme.space.sm },
              { color: theme.colors.textSecondary },
            ]}
            testID="new-task-ai-placeholder"
          >
            Coming soon: describe a task out loud and Dexter will fill this in
            for you.
          </Text>
        ) : (
          <TaskForm
            autoFocus
            form={form}
            lists={lists}
            testIDPrefix="new-task"
            onSubmit={handleSave}
            onAddSubtaskRow={scrollToEndOnNextLayout}
          />
        )}
      </ScrollView>
    </ModalScreen>
  );
}
