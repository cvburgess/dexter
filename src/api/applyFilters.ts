import { snakeCase } from "@/utils/changeCase";

export type TQueryFilter = [
  string,
  (
    | "contains"
    | "eq"
    | "gt"
    | "gte"
    | "ilike"
    | "in"
    | "is"
    | "like"
    | "lt"
    | "lte"
    | "neq"
    | "or"
    | "textSearch"
  ),
  unknown,
];

// Supabase's fluent filter builder is not exposed as a reusable table-agnostic type.
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
export const applyFilters = <TQuery>(
  query: TQuery,
  filters: TQueryFilter[] = [],
): TQuery => {
  let filteredQuery = query as any;

  for (const [column, operation, value] of filters) {
    if (operation === "or") {
      filteredQuery = filteredQuery.or(String(value));
    } else {
      filteredQuery = filteredQuery[operation](snakeCase(column), value);
    }
  }

  return filteredQuery;
};
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

/**
 * Drops exact-duplicate filter tuples (same column, operation, and value)
 * from a composed filters array, keeping the first occurrence. Callers that
 * combine independently-built filter sets (e.g. a base scope plus a named
 * preset) can end up with the same clause twice — harmless to Postgres, but
 * worth collapsing before it's sent.
 */
export const dedupeFilters = (filters: TQueryFilter[]): TQueryFilter[] => {
  const seen = new Set<string>();

  return filters.filter((filter) => {
    const key = JSON.stringify(filter);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const makeOrFilter = (filters: TQueryFilter[]): TQueryFilter => {
  return [
    "",
    "or",
    filters
      .map((filter) => {
        const [column, operation, value] = filter;
        return `${snakeCase(column) as string}.${operation}.${formatOrFilterValue(
          operation,
          value,
        )}`;
      })
      .join(","),
  ];
};

const formatOrFilterValue = (
  operation: TQueryFilter[1],
  value: unknown,
): string => {
  if (operation === "in" && Array.isArray(value)) {
    return `(${value.map(String).join(",")})`;
  }

  return String(value);
};
