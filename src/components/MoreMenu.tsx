import { Temporal } from "@js-temporal/polyfill";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import { ETaskPriority } from "@/api/tasks";
import { useLists } from "@/hooks/useLists";
import { formatMonthDayYear } from "@/utils/formatPlainDate";
import { Theme, useTheme } from "@/utils/theme";
import { weekStartEnd } from "@/utils/weekStartEnd";

import { IconMenu, TIconMenuSection } from "./IconMenu";
import { getListSections } from "./ListButton";
import { PRIORITY_OPTIONS, priorityIconColor } from "./PriorityControl";

type TMoreMenuProps = {
  priority: ETaskPriority;
  scheduledFor: string | null;
  listId: string | null;
  onChangePriority: (priority: ETaskPriority) => void;
  onChangeSchedule: (scheduledFor: string | null) => void;
  onChangeList: (listId: string | null) => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Wraps `children` (the whole task card) with a long-press menu for priority, schedule, and list. */
export function MoreMenu({
  priority,
  scheduledFor,
  listId,
  onChangePriority,
  onChangeSchedule,
  onChangeList,
  children,
  style,
}: TMoreMenuProps) {
  const theme = useTheme();
  const [lists] = useLists();
  const sections = [
    ...getPrioritySections(priority, onChangePriority, theme),
    ...getScheduleSections(scheduledFor, onChangeSchedule),
    // ListButton's sections, collapsed into a titled submenu like the others.
    ...getListSections(lists, listId, onChangeList).map((section) => ({
      ...section,
      title: "List",
      isSubmenu: true,
    })),
  ];

  return (
    <IconMenu
      accessibilityLabel="More"
      trigger="longPress"
      sections={sections}
      style={style}
    >
      {children}
    </IconMenu>
  );
}

export const getPrioritySections = (
  priority: ETaskPriority,
  onChangePriority: (priority: ETaskPriority) => void,
  theme: Theme,
): TIconMenuSection[] => [
  {
    title: "Priority",
    isSubmenu: true,
    // `PRIORITY_OPTIONS` is ordered to match the shorthand tokens: `!` → `!!!!`.
    options: PRIORITY_OPTIONS.map(({ label, value, icon }) => ({
      id: label.toLowerCase().replace(/[^a-z]+/g, "-"),
      title: label,
      icon,
      iconColor: priorityIconColor(value, theme),
      isSelected: priority === value,
      onSelect: () => onChangePriority(value),
    })),
  },
];

export const getScheduleSections = (
  scheduledFor: string | null,
  onChangeSchedule: (scheduledFor: string | null) => void,
): TIconMenuSection[] => {
  const today = Temporal.Now.plainDateISO().toString();
  const tomorrow = Temporal.Now.plainDateISO().add({ days: 1 }).toString();
  const { monday } = weekStartEnd(1);
  const nextMonday = monday.toString();

  const scheduledDate = scheduledFor
    ? Temporal.PlainDate.from(scheduledFor)
    : null;
  const isScheduledForNextWeek =
    scheduledDate !== null &&
    scheduledDate.until(monday).days <= 0 &&
    scheduledDate.until(monday).days >= -6;

  const options = [
    {
      id: today,
      title: "Today",
      isSelected: scheduledFor === today,
      onSelect: () => onChangeSchedule(today),
    },
    {
      id: tomorrow,
      title: "Tomorrow",
      isSelected: scheduledFor === tomorrow,
      onSelect: () => onChangeSchedule(tomorrow),
    },
  ];

  if (!isScheduledForNextWeek && tomorrow !== nextMonday) {
    options.push({
      id: nextMonday,
      title: "Next Week",
      isSelected: false,
      onSelect: () => onChangeSchedule(nextMonday),
    });
  }

  if (scheduledFor && scheduledDate) {
    if (scheduledFor !== today && scheduledFor !== tomorrow) {
      options.push({
        id: scheduledFor,
        title: formatMonthDayYear(scheduledDate),
        isSelected: true,
        onSelect: () => {
          // Already scheduled for this custom date; no-op.
        },
      });
    }

    options.push({
      id: "unschedule",
      title: "Unschedule",
      isSelected: false,
      onSelect: () => onChangeSchedule(null),
    });
  }

  return [{ title: "Schedule", isSubmenu: true, options }];
};
