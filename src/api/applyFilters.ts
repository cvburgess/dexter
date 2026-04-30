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
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
export const applyFilters = (query: any, filters: TQueryFilter[] = []) => {
  for (const [column, operation, value] of filters) {
    if (operation === "or") {
      query.or(String(value));
    } else {
      query = query[operation](snakeCase(column), value);
    }
  }
};
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

export const makeOrFilter = (filters: TQueryFilter[]): TQueryFilter => {
  return [
    "",
    "or",
    filters
      .map((filter) => {
        const [column, operation, value] = filter;
        return `${snakeCase(column) as string}.${operation}.${String(value)}`;
      })
      .join(","),
  ];
};
