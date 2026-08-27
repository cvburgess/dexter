// Import-free (Deno needs .ts extensions Metro/tsc forbid). Persisted as
// smallint — numbering doubles as `.order("status")` sort order.
export enum ETaskStatus {
  IN_PROGRESS,
  TODO,
  DONE,
  WONT_DO,
  DELEGATED,
}

// The single place "terminal" is defined (DEX-68); accepts `number` so the
// server can pass a raw column value straight in.
export const isCompletionStatus = (
  status: ETaskStatus | number | null | undefined,
): status is ETaskStatus.DONE | ETaskStatus.WONT_DO | ETaskStatus.DELEGATED =>
  status === ETaskStatus.DONE ||
  status === ETaskStatus.WONT_DO ||
  status === ETaskStatus.DELEGATED;

// The complement of isCompletionStatus, as an array for `.in("status", …)`.
// Keep it in step with isCompletionStatus when a status is added.
export const OPEN_TASK_STATUSES: ETaskStatus[] = [
  ETaskStatus.TODO,
  ETaskStatus.IN_PROGRESS,
];
