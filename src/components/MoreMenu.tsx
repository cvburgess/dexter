import { Temporal } from "@js-temporal/polyfill";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import { ETaskPriority } from "@/api/tasks";
import { formatMonthDayYear } from "@/utils/formatPlainDate";
import { weekStartEnd } from "@/utils/weekStartEnd";

import { IconMenu, TIconMenuSection } from "./IconMenu";

type TMoreMenuProps = {
  priority: ETaskPriority;
  scheduledFor: string | null;
  onChangePriority: (priority: ETaskPriority) => void;
  onChangeSchedule: (scheduledFor: string | null) => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Wraps `children` (the whole task card) with a long-press menu for priority and schedule. */
export function MoreMenu({
  priority,
  scheduledFor,
  onChangePriority,
  onChangeSchedule,
  children,
  style,
}: TMoreMenuProps) {
  const sections = [
    ...getPrioritySections(priority, onChangePriority),
    ...getScheduleSections(scheduledFor, onChangeSchedule),
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
): TIconMenuSection[] => [
  {
    title: "Priority",
    isSubmenu: true,
    // Ordered to match the shorthand tokens: `!` → `!!!!`.
    options: [
      { id: "urgent", title: "Urgent", value: ETaskPriority.URGENT },
      { id: "important", title: "Important", value: ETaskPriority.IMPORTANT },
      {
        id: "important-and-urgent",
        title: "Important & Urgent",
        value: ETaskPriority.IMPORTANT_AND_URGENT,
      },
      { id: "neither", title: "Neither", value: ETaskPriority.NEITHER },
    ].map(({ value, ...option }) => ({
      ...option,
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
