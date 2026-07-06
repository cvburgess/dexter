import { Temporal } from "@js-temporal/polyfill";
import { useState } from "react";

import { TList } from "@/api/lists";
import { ETaskPriority, TCreateTask } from "@/api/tasks";
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
  /** The resolved payload for `createTask`, with tokens stripped from the title. */
  task: TCreateTask;
  canSave: boolean;
};

/**
 * State for the create-task form. Shorthand tokens typed into the title
 * (`!` priority, `#list-slug`, `due:N`) drive the matching controls live;
 * once a control is changed manually, the manual value wins over tokens.
 */
export const useNewTaskForm = (lists: TList[]): TNewTaskForm => {
  const [title, setTitle] = useState("");
  const [scheduledFor, setScheduledFor] = useState(() =>
    Temporal.Now.plainDateISO().toString(),
  );

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
    task: { title: cleanTitle, priority, listId, scheduledFor, dueOn },
    canSave: cleanTitle.length > 0,
  };
};
