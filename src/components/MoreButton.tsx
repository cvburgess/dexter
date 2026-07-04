import { Temporal } from "@js-temporal/polyfill";
import { StyleSheet, Text, View } from "react-native";

import { ETaskPriority } from "@/api/tasks";
import { useTheme } from "@/utils/theme";
import { weekStartEnd } from "@/utils/weekStartEnd";

import { IconMenu, TIconMenuSection } from "./IconMenu";

type TMoreButtonProps = {
  priority: ETaskPriority;
  scheduledFor: string | null;
  onChangePriority: (priority: ETaskPriority) => void;
  onChangeSchedule: (scheduledFor: string | null) => void;
};

export function MoreButton({
  priority,
  scheduledFor,
  onChangePriority,
  onChangeSchedule,
}: TMoreButtonProps) {
  const theme = useTheme();
  const sections = [
    ...getPrioritySections(priority, onChangePriority),
    ...getScheduleSections(scheduledFor, onChangeSchedule),
  ];

  return (
    <IconMenu accessibilityLabel="More" menuTitle="More" sections={sections}>
      <View
        style={[styles.button, { backgroundColor: theme.colors.background }]}
      >
        <Text style={[styles.glyph, { color: theme.colors.text }]}>⋯</Text>
      </View>
    </IconMenu>
  );
}

export const getPrioritySections = (
  priority: ETaskPriority,
  onChangePriority: (priority: ETaskPriority) => void,
): TIconMenuSection[] => [
  {
    title: "Priority",
    options: [
      {
        id: "important-and-urgent",
        title: "Important & Urgent",
        value: ETaskPriority.IMPORTANT_AND_URGENT,
      },
      { id: "important", title: "Important", value: ETaskPriority.IMPORTANT },
      { id: "urgent", title: "Urgent", value: ETaskPriority.URGENT },
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
        title: scheduledDate.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
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

  return [{ title: "Schedule", options }];
};

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  glyph: {
    fontSize: 18,
  },
});
