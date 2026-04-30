import { Temporal } from "@js-temporal/polyfill";

import { ETaskPriority } from "@/api/tasks";
import { TList } from "@/api/lists";
import { parseTaskShorthand } from "@/utils/parseTaskShorthand";

const lists: TList[] = [
  {
    createdAt: "2026-01-01T00:00:00Z",
    emoji: "list",
    id: "list-1",
    isArchived: false,
    title: "My First List",
  },
];

describe("parseTaskShorthand", () => {
  it("parses priority, list, and due-date shorthand", () => {
    const result = parseTaskShorthand(
      "Write proposal !! #My-First-List due:2",
      lists,
    );

    expect(result).toEqual({
      dueOn: Temporal.Now.plainDateISO().add({ days: 2 }).toString(),
      listId: "list-1",
      priority: ETaskPriority.IMPORTANT,
      title: "Write proposal",
    });
  });

  it("leaves the original input when shorthand removes the whole title", () => {
    expect(parseTaskShorthand("!!").title).toBe("!!");
  });
});
