import { Temporal } from "@js-temporal/polyfill";
import { useState } from "react";

import { TList } from "@/api/lists";
import { ETaskPriority, TCreateTask, TSubtask, TTask } from "@/api/tasks";
import { TTemplate } from "@/api/templates";
import { withTitledRows } from "@/components/SubtaskFields";
import { parseTaskShorthand } from "@/utils/parseTaskShorthand";
import { subtasksFromTemplate } from "@/utils/subtasks";
import { normalizeTaskUrl } from "@/utils/taskUrl";

export type TTaskForm = {
  /** Raw title input. In create mode it still carries any shorthand tokens. */
  title: string;
  setTitle: (title: string) => void;
  priority: ETaskPriority;
  setPriority: (priority: ETaskPriority) => void;
  listId: string | null;
  setListId: (listId: string | null) => void;
  /** ISO date the task is scheduled for, or null when unscheduled.
   * Control-only (no shorthand token). */
  scheduledFor: string | null;
  setScheduledFor: (scheduledFor: string | null) => void;
  dueOn: string | null;
  setDueOn: (dueOn: string | null) => void;
  /** The day the form is about, fixed at mount — what an empty date row
   * fills itself with (DEX-165). */
  anchorDate: string;
  /** Time-of-day the alarm fires (`"HH:MM"`), or null when no alarm is set. */
  alarmTime: string | null;
  setAlarmTime: (alarmTime: string | null) => void;
  /** Raw link input, held verbatim while typing — normalizeTaskUrl runs on
   * the way into the payload, never under the user mid-keystroke. */
  url: string;
  setUrl: (url: string) => void;
  /** Checklist items to save alongside the task, in insertion order. */
  subtasks: TSubtask[];
  setSubtasks: (subtasks: TSubtask[]) => void;
  /** Fills the form from a task template, leaving its dates alone (DEX-65). */
  applyTemplate: (template: TTemplate) => void;
  /** The template the form was seeded from (or the task's own), else null.
   * The picker's selection and the saved template_id both read it. */
  templateId: string | null;
  /** The resolved payload — tokens stripped in create mode, verbatim in
   * edit. goalId/status are absent: the form doesn't own them. */
  task: TCreateTask;
  canSave: boolean;
};

type TUseTaskFormOptions = {
  /** Create mode: ISO date to schedule the new task for, defaulting to
   * today. Ignored when `task` is set — it brings its own schedule. */
  defaultScheduledFor?: string;
  /** Create mode: a link shared in from another app's share sheet
   * (DEX-66). Ignored when `task` is set, which brings its own link. */
  defaultUrl?: string;
  /** Edit mode: the task to seed from; its presence leaves create mode. */
  task?: TTask;
};

// The value can arrive from an untrusted deep-link param (or be a saved task's
// null): normalize and fall back to today rather than throwing at render.
const resolveScheduledFor = (value?: string | null): string => {
  const today = Temporal.Now.plainDateISO().toString();
  if (!value) return today;
  try {
    return Temporal.PlainDate.from(value).toString();
  } catch {
    return today;
  }
};

// Task form state shared by the create and edit modals. Shorthand tokens
// are create-only: a saved title may hold literal !/# tokens (DEX-98).
export const useTaskForm = (
  lists: TList[],
  { defaultScheduledFor, defaultUrl, task }: TUseTaskFormOptions = {},
): TTaskForm => {
  const isEditing = task !== undefined;

  const [title, setTitle] = useState(task?.title ?? "");
  const [scheduledFor, setScheduledFor] = useState<string | null>(() =>
    task ? task.scheduledFor : resolveScheduledFor(defaultScheduledFor),
  );
  // Read once: the day the form opened on outlives every later edit to
  // `scheduledFor`, including clearing it; an unscheduled task anchors to today.
  const [anchorDate] = useState(() =>
    resolveScheduledFor(task ? task.scheduledFor : defaultScheduledFor),
  );
  const [alarmTime, setAlarmTime] = useState<string | null>(
    task?.alarmTime ?? null,
  );
  const [subtasks, setSubtasks] = useState<TSubtask[]>(task?.subtasks ?? []);
  // A saved task's link wins over a shared one: editing is never the target of
  // a share, so the two can't both be meaningful.
  const [url, setUrl] = useState(task?.url ?? defaultUrl ?? "");
  // Provenance, never cleared once set: dropping the id would produce a task
  // whose contents came from a template but which claims otherwise.
  const [templateId, setTemplateId] = useState<string | null>(
    task?.templateId ?? null,
  );

  // `undefined` means "no manual override yet — follow the shorthand tokens".
  // Edit mode has no tokens, so every slot starts filled from the task.
  const [priorityOverride, setPriorityOverride] = useState<
    ETaskPriority | undefined
  >(task?.priority);
  const [listOverride, setListOverride] = useState<string | null | undefined>(
    task ? task.listId : undefined,
  );
  const [dueOnOverride, setDueOnOverride] = useState<string | null | undefined>(
    task ? task.dueOn : undefined,
  );

  // Never run in edit mode, so a saved title can't be rewritten. `due:N`
  // counts from the anchor, landing where the Deadline row's default would.
  const parsed = isEditing
    ? undefined
    : parseTaskShorthand(title, lists, anchorDate);

  const priority =
    priorityOverride ?? parsed?.priority ?? ETaskPriority.UNPRIORITIZED;
  const listId =
    listOverride !== undefined ? listOverride : (parsed?.listId ?? null);
  const dueOn =
    dueOnOverride !== undefined ? dueOnOverride : (parsed?.dueOn ?? null);

  const cleanTitle = (parsed?.title ?? title).trim();

  // Only titled rows reach the payload — an empty row is a half-finished edit,
  // not a checklist item.
  const savedSubtasks = withTitledRows(subtasks);

  const applyTemplate = (template: TTemplate) => {
    setTemplateId(template.id);
    setTitle(template.title);
    // The *override* setters, so the template's choices beat any shorthand in
    // its title; `dueOn` is pinned so a `due:N` token can't move it.
    setPriorityOverride(template.priority);
    setListOverride(template.listId);
    setDueOnOverride(dueOn);
    // Every item arrives unchecked with fresh ids — two tasks stamped from one
    // template never share subtask ids.
    setSubtasks(subtasksFromTemplate(template.subtasks));
    // `alarmTime` is NOT copied: this path can't guarantee AlarmKit
    // authorization, so a copied alarm would silently never ring.
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
    anchorDate,
    alarmTime,
    setAlarmTime,
    url,
    setUrl,
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
      // An empty field is no link, not an empty one — the same `null`-not-`""`
      // convention the date and alarm columns already follow.
      url: normalizeTaskUrl(url),
      // Says only "came from that template" — recurrence is a property of the
      // template's schedule, read at completion time.
      templateId,
      // A task and its checklist are written in one statement.
      subtasks: savedSubtasks,
    },
    canSave: cleanTitle.length > 0,
  };
};
