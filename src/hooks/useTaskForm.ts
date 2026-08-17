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
  /**
   * ISO date the task is scheduled for, or null when the task is unscheduled.
   * Control-only (no shorthand token).
   */
  scheduledFor: string | null;
  setScheduledFor: (scheduledFor: string | null) => void;
  dueOn: string | null;
  setDueOn: (dueOn: string | null) => void;
  /**
   * The day this form is *about*: the viewed day when creating, the task's own
   * schedule when editing, today when neither says otherwise. It is what an
   * empty date row fills itself with, so adding a deadline on a day the user
   * navigated to lands on that day rather than on today (DEX-165).
   *
   * Fixed at mount, deliberately: it anchors the form to the day it was opened
   * on, so rescheduling — or clearing the schedule outright — doesn't drag the
   * other row's default along with it.
   */
  anchorDate: string;
  /** Time-of-day the alarm fires (`"HH:MM"`), or null when no alarm is set. */
  alarmTime: string | null;
  setAlarmTime: (alarmTime: string | null) => void;
  /**
   * Raw link input. Held verbatim while typing — `normalizeTaskUrl` runs on the
   * way into the payload, so a half-typed host is never rewritten under the
   * user mid-keystroke.
   */
  url: string;
  setUrl: (url: string) => void;
  /** Checklist items to save alongside the task, in insertion order. */
  subtasks: TSubtask[];
  setSubtasks: (subtasks: TSubtask[]) => void;
  /** Fills the form from a task template, leaving its dates alone (DEX-65). */
  applyTemplate: (template: TTemplate) => void;
  /**
   * The template the form was seeded from — or, when editing, the one the task
   * already came from — or null when nothing seeded it. Both the picker's
   * selection and the saved task's `template_id` read it, so the two can't
   * disagree.
   */
  templateId: string | null;
  /**
   * The resolved payload. In create mode the title has had its tokens stripped;
   * in edit mode it is the title verbatim. `goalId` and `status` are absent
   * either way — the form does not own them, so saving can't clobber them.
   */
  task: TCreateTask;
  canSave: boolean;
};

type TUseTaskFormOptions = {
  /**
   * Create mode: the ISO date to schedule the new task for; defaults to today.
   * Ignored when `task` is set — an existing task brings its own schedule.
   */
  defaultScheduledFor?: string;
  /**
   * Create mode: the link to open the form on — a page shared into the app from
   * another app's share sheet (DEX-66). Ignored when `task` is set, which
   * brings its own link.
   */
  defaultUrl?: string;
  /**
   * Edit mode: the saved task to seed every field from. Its presence is what
   * takes the form out of create mode.
   */
  task?: TTask;
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
 * State for the task form, shared by the create modal (`new-task`) and the edit
 * modal (`edit-task/[id]`).
 *
 * **Shorthand tokens are create-only.** In create mode, `!` priority,
 * `#list-slug`, and `due:N` typed into the title drive the matching controls
 * live; once a control is changed manually, the manual value wins over tokens.
 * In edit mode the title is seeded from a saved row that may legitimately
 * contain a `!` or a `#` — parsing it would strip those characters and re-drive
 * the controls off text the user never meant as shorthand (DEX-98). So editing
 * seeds each override slot from the task's own column and never runs the parser.
 */
export const useTaskForm = (
  lists: TList[],
  { defaultScheduledFor, defaultUrl, task }: TUseTaskFormOptions = {},
): TTaskForm => {
  const isEditing = task !== undefined;

  const [title, setTitle] = useState(task?.title ?? "");
  const [scheduledFor, setScheduledFor] = useState<string | null>(() =>
    task ? task.scheduledFor : resolveScheduledFor(defaultScheduledFor),
  );
  // Read once and never updated: the day the form was opened on outlives every
  // later edit to `scheduledFor`, including clearing it. An unscheduled task
  // has no day of its own to anchor to, so it falls back to today.
  const [anchorDate] = useState(() =>
    task
      ? resolveScheduledFor(task.scheduledFor ?? undefined)
      : resolveScheduledFor(defaultScheduledFor),
  );
  const [alarmTime, setAlarmTime] = useState<string | null>(
    task?.alarmTime ?? null,
  );
  const [subtasks, setSubtasks] = useState<TSubtask[]>(task?.subtasks ?? []);
  // A saved task's link wins over a shared one: editing is never the target of
  // a share, so the two can't both be meaningful.
  const [url, setUrl] = useState(task?.url ?? defaultUrl ?? "");
  // Provenance, not a mode: it records where the form's contents came from.
  // Deliberately never cleared once set — editing a field or switching back to
  // the New tab leaves the seeded values in place, so dropping the id would
  // produce a task whose contents came from a template but which claims
  // otherwise. Editing carries an existing task's link through untouched.
  const [templateId, setTemplateId] = useState<string | null>(
    task?.templateId ?? null,
  );

  // `undefined` means "no manual override yet — follow the shorthand tokens".
  // Editing has no tokens to follow, so every slot starts filled from the task
  // and these are simply the live values.
  const [priorityOverride, setPriorityOverride] = useState<
    ETaskPriority | undefined
  >(task?.priority);
  const [listOverride, setListOverride] = useState<string | null | undefined>(
    task ? task.listId : undefined,
  );
  const [dueOnOverride, setDueOnOverride] = useState<string | null | undefined>(
    task ? task.dueOn : undefined,
  );

  // Not merely ignored in edit mode — never run, so a saved title can't be
  // rewritten by the parser on its way to the payload.
  const parsed = isEditing ? undefined : parseTaskShorthand(title, lists);

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
    // The *override* setters, so the template's choices survive whatever
    // shorthand tokens its title happens to contain. `dueOn` is pinned to its
    // current value for the same reason: it has no template counterpart to
    // restate, but a `due:N` token in the title would otherwise move it.
    setPriorityOverride(template.priority);
    setListOverride(template.listId);
    setDueOnOverride(dueOn);
    // A template's checklist is a blueprint, so every item arrives unchecked.
    // `subtasksFromTemplate` mints fresh ids, so two tasks stamped from one
    // template never share them.
    setSubtasks(subtasksFromTemplate(template.subtasks));
    // `scheduledFor` is left alone on purpose — a template carries no dates, and
    // the task belongs on the day the user was viewing. `url` likewise: a
    // template has no link column, so applying one has nothing to say about a
    // link the user (or a share) already put in the field.
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
      // Stamped from a template: `template_id` says only "this task came from
      // that template". Nothing recurs from it — that is a property of the
      // template's schedule, read at completion time — and the picker only
      // offers scheduleless rows anyway.
      templateId,
      // A task and its checklist are written in one statement.
      subtasks: savedSubtasks,
    },
    canSave: cleanTitle.length > 0,
  };
};
