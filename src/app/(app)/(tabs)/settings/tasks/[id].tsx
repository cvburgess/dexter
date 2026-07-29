import { Href, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { ETaskPriority, TTask } from "@/api/tasks";
import {
  NEW_TEMPLATE,
  templateFieldsFromTask,
  TTemplate,
  TTemplateSubtask,
} from "@/api/templates";
import { Button } from "@/components/Button";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { DismissModal } from "@/components/DismissModal";
import { FormRow } from "@/components/FormRow";
import {
  loadFailedMessage,
  ModalErrorScreen,
} from "@/components/ModalErrorScreen";
import { ModalLoadingScreen } from "@/components/ModalLoadingScreen";
import { ModalScreen } from "@/components/ModalScreen";
import { PickerField } from "@/components/PickerField";
import { PriorityControl } from "@/components/PriorityControl";
import { SubtaskFields, withTitledRows } from "@/components/SubtaskFields";
import { TextInput } from "@/components/TextInput";
import { TimeField } from "@/components/TimeField";
import { WebModalHeader } from "@/components/WebModalHeader";
import { WeekdayPicker } from "@/components/WeekdayPicker";
import { useConfirmation } from "@/hooks/useConfirmation";
import { useDismissModal } from "@/hooks/useDismissModal";
import { useGoals } from "@/hooks/useGoals";
import { useLists } from "@/hooks/useLists";
import { useModalHeaderActions } from "@/hooks/useModalHeaderActions";
import { useTasks } from "@/hooks/useTasks";
import { useTemplates } from "@/hooks/useTemplates";
import { DEFAULT_ALARM_TIME, isAlarmSupported } from "@/utils/alarms";
import {
  buildSchedule,
  parseSchedule,
  TRepeatFrequency,
} from "@/utils/repeatSchedule";
import { showSaveError } from "@/utils/showSaveError";
import { useTheme } from "@/utils/theme";

/** Where this modal returns to when it can't just pop — one value, because a
 * stale link and a ✕ have to land in the same place. */
const HOME: Href = "/settings/tasks";

// The universal Picker's item values cannot be null, so "none" gets a sentinel
// that can never collide with a real id.
const NO_VALUE = "";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * "Never" is not a cadence, so it stays out of the shared `TRepeatFrequency`
 * union — it means "this row has no schedule at all", which is what makes it a
 * task template rather than a repeat task (DEX-65).
 */
type TEditorFrequency = TRepeatFrequency | "never";

const FREQUENCIES: { value: TEditorFrequency; label: string }[] = [
  { value: "never", label: "Never" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

// Max day-of-month per month (February = 29 to allow a leap-day yearly repeat).
// Used to clamp the yearly day picker so an impossible date like Feb 30 — which
// the schedule can never match — is unselectable.
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const dayOptions = (maxDay: number) =>
  Array.from({ length: maxDay }, (_, i) => i + 1);

/**
 * The unsaved shape a menu action starts from, seeded off its task. Repeat
 * opens on a daily cadence and Save as template on none, which is the only
 * difference between the two — either can be changed before saving.
 */
const draftFromTask = (task: TTask, repeats: boolean): TTemplateDraft => ({
  ...templateFieldsFromTask(task),
  schedule: repeats ? buildSchedule({ frequency: "daily" }) : null,
});

/** An `existing` template, or the seed for one that hasn't been written yet. */
type TTemplateDraft = Omit<TTemplate, "id" | "createdAt" | "userId">;

export default function RepeatScheduleScreen() {
  const { id, fromTask, repeats } = useLocalSearchParams<{
    id: string;
    fromTask?: string;
    repeats?: string;
  }>();
  // Both queries are aliased, not just one: this screen resolves a template
  // *and* a task, and a bare `isLoading` in a file routed at `settings/tasks`
  // reads like the tasks query when it is in fact the templates one.
  const [
    ,
    {
      getTemplateById,
      isError: isTemplatesError,
      isLoading: isLoadingTemplates,
      refetch: refetchTemplates,
    },
  ] = useTemplates();
  const [
    tasks,
    { isError: isTasksError, isLoading: isLoadingTasks, refetch: refetchTasks },
  ] = useTasks();

  // Repeat and Save as template both route here before anything is stored,
  // carrying the task to seed from — so ✕ leaves nothing behind and ✓ is what
  // writes the row.
  if (id === NEW_TEMPLATE) {
    const task = tasks.find((candidate) => candidate.id === fromTask);
    if (!task) {
      if (isLoadingTasks) return <ModalLoadingScreen fallback={HOME} />;
      if (isTasksError) {
        return (
          <ModalErrorScreen
            fallback={HOME}
            message={loadFailedMessage("tasks")}
            onRetry={refetchTasks}
          />
        );
      }
      return <DismissModal fallback={HOME} />;
    }
    return (
      <RepeatScheduleForm
        draft={draftFromTask(task, repeats === "1")}
        // Only a task that doesn't already come from a template — of either
        // kind — is free to be linked. A task has one `template_id`, and
        // re-pointing it would rewrite where it came from and could leave a
        // repeat with nothing to fire from; `useTemplates` seeds the new row
        // its own first occurrence instead. Under the current menu this is only
        // reachable for a linked task via a deep link, but it is what makes
        // that harmless.
        linkTaskId={task.templateId ? undefined : task.id}
      />
    );
  }

  const existing = getTemplateById(id);

  if (!existing) {
    // Still fetching: wait for the template so the form initializes from its
    // saved values.
    if (isLoadingTemplates) return <ModalLoadingScreen fallback={HOME} />;
    if (isTemplatesError) {
      return (
        <ModalErrorScreen
          fallback={HOME}
          message={loadFailedMessage("repeat schedules")}
          onRetry={refetchTemplates}
        />
      );
    }
    // Loaded with no match (stale link / deleted template): the id is invalid,
    // so close rather than spin forever.
    return <DismissModal fallback={HOME} />;
  }

  // The `key` remounts the form if the resolved template changes.
  return (
    <RepeatScheduleForm
      key={existing.id}
      draft={existing}
      existing={existing}
    />
  );
}

function RepeatScheduleForm({
  draft,
  existing,
  linkTaskId,
}: {
  draft: TTemplateDraft;
  /** Absent for a draft — the row does not exist yet. */
  existing?: TTemplate;
  /** The task a draft was seeded from, linked to the new row on save. */
  linkTaskId?: string;
}) {
  const theme = useTheme();

  const [lists] = useLists();
  const [goals] = useGoals();
  const [, { createTemplate, updateTemplate, deleteTemplate }] = useTemplates();
  const { confirm, confirmationProps } = useConfirmation();

  const parsed = parseSchedule(draft.schedule);

  const [title, setTitle] = useState(draft.title);
  const [priority, setPriority] = useState<ETaskPriority>(draft.priority);
  const [listId, setListId] = useState<string | null>(draft.listId);
  const [goalId, setGoalId] = useState<string | null>(draft.goalId);
  const [alarmTime, setAlarmTime] = useState<string | null>(draft.alarmTime);
  const [subtasks, setSubtasks] = useState<TTemplateSubtask[]>(draft.subtasks);
  // `parseSchedule` falls back to daily for a null schedule, so the template
  // case has to be read off the row itself rather than off the parse.
  const [frequency, setFrequency] = useState<TEditorFrequency>(
    draft.schedule === null ? "never" : parsed.frequency,
  );
  const [weekdays, setWeekdays] = useState<number[]>(
    parsed.frequency === "weekly" ? parsed.weekdays : [1],
  );
  const [dayOfMonth, setDayOfMonth] = useState(
    parsed.frequency === "monthly" || parsed.frequency === "yearly"
      ? parsed.dayOfMonth
      : 1,
  );
  const [month, setMonth] = useState(
    parsed.frequency === "yearly" ? parsed.month : 1,
  );
  const hasSaved = useRef(false);

  const canSave =
    title.trim().length > 0 && (frequency !== "weekly" || weekdays.length > 0);

  // A template, not a repeat — drives every piece of copy on the screen so the
  // editor reads correctly the moment the frequency is switched, not only
  // after it is saved.
  const isTemplate = frequency === "never";

  const buildCurrentSchedule = (): string | null => {
    switch (frequency) {
      case "never":
        return null;
      case "daily":
        return buildSchedule({ frequency: "daily" });
      case "weekly":
        return buildSchedule({ frequency: "weekly", weekdays });
      case "monthly":
        return buildSchedule({ frequency: "monthly", dayOfMonth });
      case "yearly":
        return buildSchedule({ frequency: "yearly", month, dayOfMonth });
    }
  };

  // Pops rather than navigating: the stack this screen was pushed onto already
  // has the list under it (`tasks/_layout.tsx` anchors it), and popping keeps
  // whatever is under *that* — without it the Tasks screen becomes the root of
  // the settings tab and loses its own back button.
  const handleClose = useDismissModal(HOME);

  const handleSave = () => {
    if (hasSaved.current || !canSave) return;
    hasSaved.current = true;

    const fields = {
      title: title.trim(),
      priority,
      listId,
      goalId,
      alarmTime,
      schedule: buildCurrentSchedule(),
      // Drop any row left untitled — an empty row is an abandoned edit.
      subtasks: withTitledRows(subtasks),
    };
    const callbacks = {
      onSuccess: handleClose,
      onError: () => {
        hasSaved.current = false;
        showSaveError("changes");
      },
    };

    // A draft has no row yet — ✓ is what writes it. `createTemplate` links the
    // source task whatever cadence it was saved on: the task did come from this
    // template either way, and a scheduled row gets the open task it needs to
    // fire from for free.
    if (existing) updateTemplate({ id: existing.id, ...fields }, callbacks);
    else createTemplate({ template: fields, linkTaskId }, callbacks);
  };

  // One destructive action, one message, whether or not the row has a schedule.
  // "Stop repeating" used to live here too, but setting Repeats to Never now
  // does that — and keeps the template — so a second button offering it only
  // blurred the difference between dropping the schedule and deleting the row.
  const handleDelete = async () => {
    if (!existing) return;
    const confirmed = await confirm({
      title: "Delete template?",
      message:
        "This deletes the template. Tasks you already created from it are unaffected.",
      confirmLabel: "Delete Template",
      destructive: true,
    });
    if (!confirmed) return;
    deleteTemplate(existing.id, {
      onSuccess: handleClose,
      onError: () => showSaveError("changes"),
    });
  };

  const toggleWeekday = (day: number) =>
    setWeekdays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => a - b),
    );

  useModalHeaderActions({
    // Follows the picker in every case, drafts included: a draft opened from
    // Repeat starts on a cadence, so titling it "New Template" would describe
    // the wrong thing.
    title: isTemplate
      ? existing
        ? "Template"
        : "New Template"
      : existing
        ? "Repeat Schedule"
        : "New Repeat Schedule",
    canSave,
    onClose: handleClose,
    onSave: handleSave,
  });

  return (
    <ModalScreen>
      <WebModalHeader
        isDisabled={!canSave}
        onClose={handleClose}
        onSave={handleSave}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        // Insets the content by the keyboard's height (iOS) so a subtask row it
        // covers stays reachable. Android resizes the window instead.
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[
          styles.container,
          { gap: theme.gap, padding: theme.spacing },
        ]}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: theme.colors.background }}
      >
        <TextInput
          accessibilityLabel="Task title"
          placeholder="What needs to be done?"
          returnKeyType="done"
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={handleSave}
        />

        <FormRow label="Priority">
          <PriorityControl priority={priority} onChangePriority={setPriority} />
        </FormRow>

        <PickerField
          label="List"
          options={[
            { label: "None", value: NO_VALUE },
            ...lists.map((list) => ({
              label: `${list.emoji} ${list.title}`,
              value: list.id,
            })),
          ]}
          selectedValue={listId ?? NO_VALUE}
          onValueChange={(value) =>
            setListId(value === NO_VALUE ? null : value)
          }
        />

        <PickerField
          label="Goal"
          options={[
            { label: "None", value: NO_VALUE },
            ...goals.map((goal) => ({
              label: goal.emoji ? `${goal.emoji} ${goal.title}` : goal.title,
              value: goal.id,
            })),
          ]}
          selectedValue={goalId ?? NO_VALUE}
          onValueChange={(value) =>
            setGoalId(value === NO_VALUE ? null : value)
          }
        />

        {isAlarmSupported && (
          <FormRow label="Alarm">
            {alarmTime === null ? (
              <TouchableOpacity
                onPress={() => setAlarmTime(DEFAULT_ALARM_TIME)}
                accessibilityRole="button"
              >
                <Text
                  style={[styles.alarmAction, { color: theme.colors.primary }]}
                >
                  Add alarm
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.alarmControl, { gap: theme.gap }]}>
                <TimeField
                  accentColor={theme.colors.primary}
                  value={alarmTime}
                  onChange={setAlarmTime}
                />
                <TouchableOpacity
                  onPress={() => setAlarmTime(null)}
                  accessibilityRole="button"
                >
                  <Text
                    style={[styles.alarmAction, { color: theme.colors.error }]}
                  >
                    Remove
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </FormRow>
        )}

        <SubtaskFields
          value={subtasks}
          onChange={setSubtasks}
          makeRow={(id) => ({ id, title: "" })}
          testIDPrefix="template"
        />

        <PickerField
          label="Repeats"
          options={FREQUENCIES}
          selectedValue={frequency}
          onValueChange={setFrequency}
        />

        {frequency === "weekly" && (
          <FormRow label="On days">
            <WeekdayPicker
              valueSource="cron"
              selected={weekdays}
              onToggle={toggleWeekday}
            />
          </FormRow>
        )}

        {frequency === "yearly" && (
          <PickerField
            label="Month"
            options={MONTHS.map((label, index) => ({
              label,
              value: String(index + 1),
            }))}
            selectedValue={String(month)}
            onValueChange={(value) => {
              const nextMonth = Number(value);
              setMonth(nextMonth);
              // Clamp so switching to a shorter month can't leave an
              // impossible day selected (e.g. 31 → February).
              setDayOfMonth((day) =>
                Math.min(day, DAYS_IN_MONTH[nextMonth - 1]),
              );
            }}
          />
        )}

        {(frequency === "monthly" || frequency === "yearly") && (
          <PickerField
            label="Day of month"
            options={dayOptions(
              frequency === "yearly" ? DAYS_IN_MONTH[month - 1] : 31,
            ).map((day) => ({ label: String(day), value: String(day) }))}
            selectedValue={String(dayOfMonth)}
            onValueChange={(value) => setDayOfMonth(Number(value))}
          />
        )}

        {/* A draft has no row to delete — ✕ is how you abandon it. */}
        {existing && (
          <View style={styles.dangerZone}>
            <Button variant="dangerous" onPress={handleDelete}>
              Delete Template
            </Button>
          </View>
        )}
      </ScrollView>

      <ConfirmationModal {...confirmationProps} />
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 32,
  },
  dangerZone: {
    gap: 12,
    marginTop: 12,
  },
  alarmControl: {
    alignItems: "center",
    flexDirection: "row",
  },
  alarmAction: {
    fontSize: 16,
    fontWeight: "600",
  },
});
