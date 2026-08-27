// Import-free like taskStatus.ts. Persisted as smallint, lower is more
// urgent; UNPRIORITIZED ("never chosen") sorts last, distinct from NEITHER.
export enum ETaskPriority {
  IMPORTANT_AND_URGENT,
  URGENT,
  IMPORTANT,
  NEITHER,
  UNPRIORITIZED,
}
