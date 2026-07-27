import { Temporal } from "@js-temporal/polyfill";
import { useState } from "react";

import { TList } from "@/api/lists";
import { ETaskPriority, ETaskStatus, TCreateTask, TSubtask } from "@/api/tasks";
import { TTemplate } from "@/api/templates";
import { withTitledRows } from "@/components/SubtaskFields";
import { parseTaskShorthand } from "@/utils/parseTaskShorthand";
import { subtasksFromTemplate } from "@/utils/subtasks";

export type TNewTaskForm = {
  /** Raw title input, shorthand tokens included. */
  title: string;
  setTitle: (title: string) => void;
  priority: ETaskPriority;
  setPriority: (priority: ETaskPriority) => void;
  listId: string | null;
  setListId: (listId: string | null) => void;
  /**
   * ISO date the task is scheduled for, or null when the task is unscheduled.
   * Control-only (no shorthand token).
   */
  scheduledFor: string | null;
  setScheduledFor: (scheduledFor: string | null) => void;
  dueOn: string | null;
  setDueOn: (dueOn: string | null) => void;
  /** Time-of-day the alarm fires (`"HH:MM"`), or null when no alarm is set. */
  alarmTime: string | null;
  setAlarmTime: (alarmTime: string | null) => void;
  /** Checklist items to create alongside the task, in insertion order. */
  subtasks: TSubtask[];
  setSubtasks: (subtasks: TSubtask[]) => void;
  /** Fills the form from a task template, leaving its dates alone (DEX-65). */
  applyTemplate: (template: TTemplate) => void;
  /**
   * The template the form was seeded from, or null when nothing seeded it. Both
   * the picker's selection and the saved task's `template_id` read it, so the
   * two can't disagree.
   */
  templateId: string | null;
  /** The resolved payload for `createTask`, with tokens stripped from the title. */
  task: TCreateTask;
  canSave: boolean;
};

// The default can arrive from an untrusted route param (deep link), so normalize
// it and fall back to today rather than letting a bad value throw downstream in
// Temporal.PlainDate.from when the date chip renders.
const resolveScheduledFor = (value?: string): string => {
  const today = Temporal.Now.plainDateISO().toString();
  if (!value) return today;
  try {
    return Temporal.PlainDate.from(value).toString();
  } catch {
    return today;
  }
};

/**
 * State for the create-task form. Shorthand tokens typed into the title
 * (`!` priority, `#list-slug`, `due:N`) drive the matching controls live;
 * once a control is changed manually, the manual value wins over tokens.
 */
export const useNewTaskForm = (
  lists: TList[],
  /** ISO date to schedule the task for; defaults to today when omitted. */
  defaultScheduledFor?: string,
): TNewTaskForm => {
  const [title, setTitle] = useState("");
  const [scheduledFor, setScheduledFor] = useState<string | null>(() =>
    resolveScheduledFor(defaultScheduledFor),
  );
  const [alarmTime, setAlarmTime] = useState<string | null>(null);
  const [subtasks, setSubtasks] = useState<TSubtask[]>([]);
  // Provenance, not a mode: it records where the form's contents came from.
  // Deliberately never cleared once set — editing a field or switching back to
  // the New tab leaves the seeded values in place, so dropping the id would
  // produce a task whose contents came from a template but which claims
  // otherwise.
  const [templateId, setTemplateId] = useState<string | null>(null);

  // `undefined` means "no manual override yet — follow the shorthand tokens".
  const [priorityOverride, setPriorityOverride] = useState<ETaskPriority>();
  const [listOverride, setListOverride] = useState<string | null>();
  const [dueOnOverride, setDueOnOverride] = useState<string | null>();

  const parsed = parseTaskShorthand(title, lists);

  const priority =
    priorityOverride ?? parsed.priority ?? ETaskPriority.UNPRIORITIZED;
  const listId =
    listOverride !== undefined ? listOverride : (parsed.listId ?? null);
  const dueOn =
    dueOnOverride !== undefined ? dueOnOverride : (parsed.dueOn ?? null);

  const cleanTitle = parsed.title.trim();

  // Only titled rows reach the payload — an empty row is a half-finished edit,
  // not a checklist item.
  const savedSubtasks = withTitledRows(subtasks);

  const applyTemplate = (template: TTemplate) => {
    setTemplateId(template.id);
    setTitle(template.title);
    // The *override* setters, so the template's choices survive whatever
    // shorthand tokens its title happens to contain. `dueOn` is pinned to its
    // current value for the same reason: it has no template counterpart to
    // restate, but a `due:N` token in the title would otherwise move it.
    setPriorityOverride(template.priority);
    setListOverride(template.listId);
    setDueOnOverride(dueOn);
    // A template's checklist is a blueprint with no status. `subtasksFromTemplate`
    // mints fresh ids, so two tasks stamped from one template never share them.
    setSubtasks(subtasksFromTemplate(template.subtasks, ETaskStatus.TODO));
    // `scheduledFor` is left alone on purpose — a template carries no dates, and
    // the task belongs on the day the user was viewing.
    //
    // `alarmTime` is deliberately NOT copied. An alarm only rings once AlarmKit
    // has been authorized and the task has a day to fire on, and this path can
    // guarantee neither — `handleAddAlarm` in the modal is what asks for
    // permission. Copying it here would seed alarms that silently never ring.
  };

  return {
    title,
    setTitle,
    priority,
    setPriority: setPriorityOverride,
    listId,
    setListId: setListOverride,
    scheduledFor,
    setScheduledFor,
    dueOn,
    setDueOn: setDueOnOverride,
    alarmTime,
    setAlarmTime,
    subtasks,
    setSubtasks,
    applyTemplate,
    templateId,
    task: {
      title: cleanTitle,
      priority,
      listId,
      scheduledFor,
      dueOn,
      alarmTime,
      // Stamped from a template: `template_id` says only "this task came from
      // that template". Nothing recurs from it — that is a property of the
      // template's schedule, read at completion time — and the picker only
      // offers scheduleless rows anyway.
      templateId,
      // A task and its checklist are created in one insert.
      subtasks: savedSubtasks,
    },
    canSave: cleanTitle.length > 0,
  };
};
