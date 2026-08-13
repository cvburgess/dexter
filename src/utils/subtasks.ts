/**
 * Pure helpers for the `subtasks` jsonb array (DEX-70), shared by the Expo app
 * and the Deno MCP server via the `@src/` alias — the same arrangement
 * `repeatSchedule.ts` uses. Nothing here may import React Native or Supabase.
 *
 * A subtask is `{id, title, done}` (DEX-153) — a checklist item, not a small
 * task. The five-member `ETaskStatus` belongs to tasks alone; the one place the
 * two meet is `promoteSubtaskInput`, which maps done → `DONE` and not-done →
 * `TODO`. Nothing here imports that enum, and can't: `utils/taskStatus.ts` is a
 * sibling leaf module and Deno requires a `.ts` extension on the relative import
 * that Metro and tsc forbid.
 */

/**
 * Longest subtask title the app will accept. Must not exceed the MCP server's
 * `subtaskTitleSchema` bound: that schema is also used to read stored rows, and
 * an over-long title there would fail validation and silently skip the
 * completion sweep for that task.
 */
export const SUBTASK_TITLE_MAX_LENGTH = 100;

let counter = 0;

/**
 * Mints a subtask id.
 *
 * Ids only need to be unique *within one task's array* — they are array
 * positions, not database keys — so this deliberately avoids pulling in a
 * native crypto dependency (`expo-crypto`) for a guarantee we don't need.
 * `crypto.randomUUID` is used where the runtime offers it (Deno, web, newer
 * Hermes); elsewhere a counter + randomness fallback keeps ids distinct even
 * when many are minted in the same millisecond, which is exactly what happens
 * when `withFreshIds` re-keys a whole array in a loop.
 */
export const makeSubtaskId = (): string => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;

  counter += 1;
  const random = Math.random().toString(36).slice(2, 10);
  return `st_${Date.now().toString(36)}_${counter.toString(36)}_${random}`;
};

/**
 * Re-keys every subtask, preserving all other fields. Used wherever an array is
 * copied onto a *different* row — duplicating a task, and materializing a
 * recurring occurrence — so the copy never shares ids with its source.
 */
export const withFreshIds = <S extends { id: string }>(
  subtasks: readonly S[],
): S[] => subtasks.map((subtask) => ({ ...subtask, id: makeSubtaskId() }));

/**
 * Checks off every subtask. Closing a parent sweeps its checklist in the *same*
 * row update, which is what makes the sweep atomic — there is no window where a
 * closed parent still shows open children.
 *
 * Any terminal parent status sweeps, not just `DONE`: a won't-do or delegated
 * task is equally finished with, and two states leave nowhere else for its
 * checklist to go. One rule, and the frozen list reads the same either way.
 */
export const completeSubtasks = <S extends { done: boolean }>(
  subtasks: readonly S[],
): S[] =>
  subtasks.map((subtask) =>
    subtask.done ? subtask : { ...subtask, done: true },
  );

/**
 * Materializes a repeat template's checklist (`{id, title}`) onto a new
 * occurrence, with fresh ids and every item unchecked. Templates store no
 * `done` of their own — a template's checklist is a blueprint, not state.
 */
export const subtasksFromTemplate = (
  templateSubtasks: readonly { title: string }[],
): { id: string; title: string; done: boolean }[] =>
  templateSubtasks.map(({ title }) => ({
    id: makeSubtaskId(),
    title,
    done: false,
  }));
