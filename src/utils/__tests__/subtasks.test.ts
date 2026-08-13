import {
  completeSubtasks,
  makeSubtaskId,
  subtasksFromTemplate,
  withFreshIds,
} from "../subtasks";

describe("makeSubtaskId", () => {
  it("mints distinct ids when called in a tight loop", () => {
    // The fallback path keys partly off Date.now(), so a same-millisecond burst
    // is exactly where a naive implementation collides — and re-keying a whole
    // array is always a same-millisecond burst.
    const ids = Array.from({ length: 500 }, () => makeSubtaskId());

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("withFreshIds", () => {
  const subtasks = [
    { id: "a", title: "First", done: false },
    { id: "b", title: "Second", done: true },
  ];

  it("replaces every id while preserving the other fields and order", () => {
    const copied = withFreshIds(subtasks);

    expect(copied.map(({ title }) => title)).toEqual(["First", "Second"]);
    expect(copied.map(({ done }) => done)).toEqual([false, true]);
    expect(copied.map(({ id }) => id)).not.toEqual(["a", "b"]);
    expect(new Set(copied.map(({ id }) => id)).size).toBe(2);
  });

  it("does not mutate the source array", () => {
    withFreshIds(subtasks);

    expect(subtasks.map(({ id }) => id)).toEqual(["a", "b"]);
  });

  it("returns an empty array unchanged", () => {
    expect(withFreshIds([])).toEqual([]);
  });
});

describe("completeSubtasks", () => {
  it("checks off every subtask, including ones already done", () => {
    const swept = completeSubtasks([
      { id: "a", title: "Open", done: false },
      { id: "b", title: "Already done", done: true },
    ]);

    expect(swept.map(({ done }) => done)).toEqual([true, true]);
  });

  it("preserves ids and titles so the sweep is not a rewrite", () => {
    const swept = completeSubtasks([{ id: "a", title: "Open", done: false }]);

    expect(swept[0]).toEqual({ id: "a", title: "Open", done: true });
  });

  it("returns an empty array unchanged", () => {
    expect(completeSubtasks([])).toEqual([]);
  });
});

describe("subtasksFromTemplate", () => {
  // Template subtasks are `{id, title}` — the id is the template's own, and the
  // point of this helper is that it never travels to the occurrence.
  const templateSubtasks: { id: string; title: string }[] = [
    { id: "t1", title: "Pack bag" },
    { id: "t2", title: "Fill bottle" },
  ];

  it("materializes template titles with fresh ids, all unchecked", () => {
    const materialized = subtasksFromTemplate(templateSubtasks);

    expect(materialized.map(({ title }) => title)).toEqual([
      "Pack bag",
      "Fill bottle",
    ]);
    expect(materialized.every(({ done }) => done === false)).toBe(true);
    // Ids must not carry over from the template — each occurrence's checklist is
    // independent state, not a reference back to the blueprint.
    expect(materialized.map(({ id }) => id)).not.toContain("t1");
    expect(materialized.map(({ id }) => id)).not.toContain("t2");
  });

  it("returns an empty array for a template with no checklist", () => {
    expect(subtasksFromTemplate([])).toEqual([]);
  });
});
