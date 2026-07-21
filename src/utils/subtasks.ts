/**
 * Pure helpers for the `subtasks` jsonb array (DEX-70), shared by the Expo app
 * and the Deno MCP server via the `@src/` alias — the same arrangement
 * `repeatSchedule.ts` uses. Nothing here may import React Native or Supabase.
 *
 * The helpers are generic over the status type so the app can keep its
 * `ETaskStatus` enum while `mcp-server` keeps its plain numeric constants;
 * neither has to widen to the other's representation.
 */

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
 * Sets every subtask to `status`. Completing a parent sweeps its checklist in
 * the *same* row update, which is what makes the sweep atomic — there is no
 * window where a done parent still shows open children.
 */
export const sweepSubtasks = <S extends { status: unknown }>(
  subtasks: readonly S[],
  status: S["status"],
): S[] =>
  subtasks.map((subtask) =>
    subtask.status === status ? subtask : { ...subtask, status },
  );

/**
 * Materializes a repeat template's checklist (`{id, title}`) onto a new
 * occurrence, with fresh ids and every item reset to open. Templates store no
 * status of their own — a template's checklist is a blueprint, not state.
 */
export const subtasksFromTemplate = <T>(
  templateSubtasks: readonly { title: string }[],
  todoStatus: T,
): { id: string; title: string; status: T }[] =>
  templateSubtasks.map(({ title }) => ({
    id: makeSubtaskId(),
    title,
    status: todoStatus,
  }));
