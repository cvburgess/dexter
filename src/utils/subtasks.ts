// Pure helpers for the `subtasks` jsonb array (DEX-70, DEX-153), shared by the
// app and the Deno MCP server via `@src/` — import-free like repeatSchedule.ts.

// Must not exceed the MCP server's subtaskTitleSchema bound — that schema also
// reads stored rows, and an over-long title there would skip the sweep.
export const SUBTASK_TITLE_MAX_LENGTH = 100;

let counter = 0;

// Ids need only be unique within one task's array (not database keys), so this
// avoids expo-crypto; the fallback stays distinct even minting many per ms.
export const makeSubtaskId = (): string => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;

  counter += 1;
  const random = Math.random().toString(36).slice(2, 10);
  return `st_${Date.now().toString(36)}_${counter.toString(36)}_${random}`;
};

// Used wherever an array copies onto a different row (duplicating a task,
// materializing a recurring occurrence) so the copy shares no ids with source.
export const withFreshIds = <S extends { id: string }>(
  subtasks: readonly S[],
): S[] => subtasks.map((subtask) => ({ ...subtask, id: makeSubtaskId() }));

// Sweeps the whole checklist atomically on close — any terminal status, not
// just DONE, since won't-do/delegated are equally finished with.
export const completeSubtasks = <S extends { done: boolean }>(
  subtasks: readonly S[],
): S[] =>
  subtasks.map((subtask) =>
    subtask.done ? subtask : { ...subtask, done: true },
  );

// Fresh ids, everything unchecked — templates store no `done` of their own,
// since a template's checklist is a blueprint, not state.
export const subtasksFromTemplate = (
  templateSubtasks: readonly { title: string }[],
): { id: string; title: string; done: boolean }[] =>
  templateSubtasks.map(({ title }) => ({
    id: makeSubtaskId(),
    title,
    done: false,
  }));
