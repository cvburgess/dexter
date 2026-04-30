import { Temporal } from "@js-temporal/polyfill";

import { TList } from "@/api/lists";
import { ETaskPriority } from "@/api/tasks";

export type TaskShorthandResult = {
  title: string;
  priority?: ETaskPriority;
  listId?: string | null;
  dueOn?: string | null;
};

const normalizeListTitle = (title: string): string => {
  return title.toLowerCase().replace(/\s+/g, "-");
};

export const parseTaskShorthand = (
  input: string,
  availableLists: TList[] = [],
): TaskShorthandResult => {
  let workingInput = input.trim();
  let priority: ETaskPriority | undefined;
  let listId: string | null = null;
  let dueOn: string | null = null;

  const priorityMatch = workingInput.match(/(?:^|\s)(!{1,4})(?:\s|$)/);
  if (priorityMatch) {
    const exclamationCount = priorityMatch[1].length;

    if (exclamationCount <= 4) {
      workingInput = workingInput.replace(priorityMatch[0], " ").trim();

      switch (exclamationCount) {
        case 1:
          priority = ETaskPriority.URGENT;
          break;
        case 2:
          priority = ETaskPriority.IMPORTANT;
          break;
        case 3:
          priority = ETaskPriority.IMPORTANT_AND_URGENT;
          break;
        case 4:
          priority = ETaskPriority.NEITHER;
          break;
      }
    }
  }

  const listMatch = workingInput.match(/#([a-zA-Z0-9-]+)(?:\s|$)/);
  if (listMatch && availableLists.length > 0) {
    const listShorthand = listMatch[1];
    const matchingList = availableLists.find(
      (list) => normalizeListTitle(list.title) === listShorthand,
    );

    if (matchingList) {
      listId = matchingList.id;
      workingInput = workingInput.replace(listMatch[0], "").trim();
    }
  }

  const dueDateMatch = workingInput.match(/due:(\d+)(?:\s|$)/);
  if (dueDateMatch) {
    const daysFromNow = parseInt(dueDateMatch[1], 10);
    const today = Temporal.Now.plainDateISO();

    dueOn = today.add({ days: daysFromNow }).toString();
    workingInput = workingInput.replace(dueDateMatch[0], "").trim();
  }

  const title = workingInput.trim();

  if (!title) {
    return { title: input.trim() };
  }

  return {
    title,
    ...(priority !== undefined && { priority }),
    ...(listId !== null && { listId }),
    ...(dueOn !== null && { dueOn }),
  };
};
