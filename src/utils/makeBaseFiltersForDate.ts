import { Temporal } from "@js-temporal/polyfill";

import { makeOrFilter } from "@/api/applyFilters";
import { taskFilters } from "@/hooks/useTasks";

export const makeBaseFiltersForDate = (date: Temporal.PlainDate) => [
  makeOrFilter([
    ["scheduledFor", "neq", date.toString()],
    ["scheduledFor", "is", null],
  ]),
  ...taskFilters.incomplete,
];
