import { TList } from "@/api/lists";
import { TTask } from "@/api/tasks";
import { isCompletionStatus } from "@/utils/taskStatus";

export type TListColumn = {
  /** `null` is the "No List" column — dropping there clears a task's list. */
  listId: string | null;
  emoji: string;
  title: string;
  tasks: TTask[];
};

// The Lists tab's columns (DEX-221): every list even when empty, led by
// "No List" only when an open task has none (or its list was archived).
export function listColumns(tasks: TTask[], lists: TList[]): TListColumn[] {
  const open = tasks.filter((task) => !isCompletionStatus(task.status));
  const listIds = new Set(lists.map((list) => list.id));
  const unlisted = open.filter(
    (task) => task.listId === null || !listIds.has(task.listId),
  );

  return [
    ...(unlisted.length > 0
      ? [{ listId: null, emoji: "🚫", title: "No List", tasks: unlisted }]
      : []),
    ...lists.map((list) => ({
      listId: list.id,
      emoji: list.emoji,
      title: list.title,
      tasks: open.filter((task) => task.listId === list.id),
    })),
  ];
}
