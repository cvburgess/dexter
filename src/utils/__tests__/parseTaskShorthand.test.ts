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

  // `due:N` counts from the form's anchor day, not the wall clock (DEX-165).
  it("counts due:N from the anchor date when one is given", () => {
    const result = parseTaskShorthand("Ship it due:3", lists, "2026-07-08");

    expect(result.dueOn).toBe("2026-07-11");
  });

  it("counts due:N across a month boundary", () => {
    const result = parseTaskShorthand("Ship it due:5", lists, "2026-07-29");

    expect(result.dueOn).toBe("2026-08-03");
  });

  it("counts due:0 as the anchor day itself", () => {
    const result = parseTaskShorthand("Ship it due:0", lists, "2026-07-08");

    expect(result.dueOn).toBe("2026-07-08");
  });

  it("leaves the original input when shorthand removes the whole title", () => {
    expect(parseTaskShorthand("!!").title).toBe("!!");
  });
});
