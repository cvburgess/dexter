import { Temporal } from "@js-temporal/polyfill";
import { useState } from "react";

import { TList } from "@/api/lists";
import {
  appendSubtask,
  ETaskPriority,
  TCreateTask,
  TSubtask,
} from "@/api/tasks";
import { parseTaskShorthand } from "@/utils/parseTaskShorthand";

export type TNewTaskForm = {
  /** Raw title input, shorthand tokens included. */
  title: string;
  setTitle: (title: string) => void;
  priority: ETaskPriority;
  setPriority: (priority: ETaskPriority) => void;
  listId: string | null;
  setListId: (listId: string | null) => void;
  /** ISO date the task is scheduled for. Control-only (no shorthand token). */
  scheduledFor: string;
  setScheduledFor: (scheduledFor: string) => void;
  dueOn: string | null;
  setDueOn: (dueOn: string | null) => void;
  /** Time-of-day the alarm fires (`"HH:MM"`), or null when no alarm is set. */
  alarmTime: string | null;
  setAlarmTime: (alarmTime: string | null) => void;
  /** Checklist items to create alongside the task, in insertion order. */
  subtasks: TSubtask[];
  /** Appends an empty row and returns its id, so the caller can focus it. */
  addSubtask: () => string;
  /** Sets a row's title; an empty title removes the row. */
  setSubtaskTitle: (id: string, title: string) => void;
  removeSubtask: (id: string) => void;
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
  const [scheduledFor, setScheduledFor] = useState(() =>
    resolveScheduledFor(defaultScheduledFor),
  );
  const [alarmTime, setAlarmTime] = useState<string | null>(null);
  const [subtasks, setSubtasks] = useState<TSubtask[]>([]);

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

  const addSubtask = (): string => {
    const next = appendSubtask(subtasks);
    setSubtasks(next);
    return next[next.length - 1].id;
  };

  const setSubtaskTitle = (id: string, title: string) =>
    setSubtasks((current) =>
      title === ""
        ? // Nothing here has been saved yet, so an emptied row is simply
          // discarded — there is no stored title to revert to.
          current.filter((subtask) => subtask.id !== id)
        : current.map((subtask) =>
            subtask.id === id ? { ...subtask, title } : subtask,
          ),
    );

  const removeSubtask = (id: string) =>
    setSubtasks((current) => current.filter((subtask) => subtask.id !== id));

  // Only titled rows reach the payload — an empty row is a half-finished edit,
  // not a checklist item.
  const savedSubtasks = subtasks.filter(({ title }) => title.trim().length > 0);

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
    addSubtask,
    setSubtaskTitle,
    removeSubtask,
    task: {
      title: cleanTitle,
      priority,
      listId,
      scheduledFor,
      dueOn,
      alarmTime,
      // A task and its checklist are created in one insert.
      subtasks: savedSubtasks,
    },
    canSave: cleanTitle.length > 0,
  };
};
