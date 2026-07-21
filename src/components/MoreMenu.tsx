import { Temporal } from "@js-temporal/polyfill";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import { ETaskPriority, TTask } from "@/api/tasks";
import { isAlarmSupported } from "@/utils/alarms";
import { useLists } from "@/hooks/useLists";
import { useTemplates } from "@/hooks/useTemplates";
import { formatMonthDayYear } from "@/utils/formatPlainDate";
import { Theme, useTheme } from "@/utils/theme";
import { weekStartEnd } from "@/utils/weekStartEnd";

import { IconMenu, TIconMenuSection } from "./IconMenu";
import { getListSections } from "./ListButton";
import { PRIORITY_OPTIONS, priorityIconColor } from "./PriorityControl";

type TMoreMenuProps = {
  task: TTask;
  onChangePriority: (priority: ETaskPriority) => void;
  onChangeSchedule: (scheduledFor: string | null) => void;
  onChangeList: (listId: string | null) => void;
  onSetAlarm: () => void;
  onClearAlarm: () => void;
  onAddSubtask?: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Wraps `children` (the whole task card) with a long-press menu for priority, schedule, list, and task actions. */
export function MoreMenu({
  task,
  onChangePriority,
  onChangeSchedule,
  onChangeList,
  onSetAlarm,
  onClearAlarm,
  onAddSubtask,
  onDuplicate,
  onDelete,
  children,
  style,
}: TMoreMenuProps) {
  const theme = useTheme();
  const router = useRouter();
  const [lists] = useLists();
  const [, { createTemplateFromTask, getTemplateById }] = useTemplates();

  const openRepeatSchedule = (templateId: string) =>
    router.push({
      pathname: "/settings/tasks/[id]",
      params: { id: templateId },
    });

  // A linked template always carries a schedule today; the extra check
  // future-proofs a later "linked template without a schedule" state (DEX-21).
  const linkedTemplate = getTemplateById(task.templateId);
  const isRepeating =
    task.templateId !== null && linkedTemplate?.schedule !== null;

  const onRepeat = () => {
    // Branch on the stored templateId, not the (possibly still-loading) template
    // lookup, so an existing repeat is never duplicated.
    if (task.templateId) {
      openRepeatSchedule(task.templateId);
    } else {
      createTemplateFromTask(task, {
        onSuccess: (template) => openRepeatSchedule(template.id),
      });
    }
  };

  // Alarms ring via native iOS AlarmKit only, so the item is iOS-only. It sits
  // inline in the "Other" group alongside Duplicate/Repeat/Delete rather than in
  // its own section — a single directly-tappable action, not a submenu.
  const alarm = isAlarmSupported
    ? {
        title: task.alarmTime ? "Unset alarm" : "Set alarm",
        onSelect: task.alarmTime ? onClearAlarm : onSetAlarm,
      }
    : undefined;

  const sections = [
    ...getPrioritySections(task.priority, onChangePriority, theme),
    ...getScheduleSections(task.scheduledFor, onChangeSchedule),
    // ListButton's sections, collapsed into a titled submenu like the others.
    ...getListSections(lists, task.listId, onChangeList).map((section) => ({
      ...section,
      title: "List",
      icon: { ios: "face.smiling", android: "mood", web: "mood" } as const,
      isSubmenu: true,
    })),
    ...getOtherSections(
      onDuplicate,
      onDelete,
      {
        label: isRepeating ? "Edit repeat schedule" : "Repeat",
        onSelect: onRepeat,
      },
      alarm,
      onAddSubtask,
    ),
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
    icon: {
      ios: "exclamationmark",
      android: "priority_high",
      web: "priority_high",
    },
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

  return [
    {
      title: "Schedule",
      icon: {
        ios: "calendar",
        android: "calendar_today",
        web: "calendar_today",
      } as const,
      isSubmenu: true,
      options,
    },
  ];
};

/**
 * Task-management actions, rendered as an inline "Other" group so the actions
 * are directly tappable rather than nested in a submenu. The optional alarm
 * toggle leads the group (iOS-only — AlarmKit does the ringing, DEX-48); it
 * flips between "Set alarm" and "Unset alarm" but keeps the same icon either
 * way. Duplicate / Repeat / Delete follow; the repeat item's label reflects
 * whether the task already has a repeat schedule, and Delete is marked
 * destructive so `IconMenu` styles it accordingly.
 */
export const getOtherSections = (
  onDuplicate: () => void,
  onDelete: () => void,
  repeat: { label: string; onSelect: () => void },
  alarm?: { title: string; onSelect: () => void },
  onAddSubtask?: () => void,
): TIconMenuSection[] => [
  {
    title: "Other",
    options: [
      ...(alarm
        ? [
            {
              id: "alarm",
              title: alarm.title,
              icon: { ios: "alarm", android: "alarm", web: "alarm" } as const,
              onSelect: alarm.onSelect,
            },
          ]
        : []),
      ...(onAddSubtask
        ? [
            {
              id: "add-subtask",
              title: "Add subtask",
              icon: {
                ios: "checklist",
                android: "checklist",
                web: "checklist",
              } as const,
              onSelect: onAddSubtask,
            },
          ]
        : []),
      {
        id: "duplicate",
        title: "Duplicate",
        icon: {
          ios: "plus.square.on.square",
          android: "content_copy",
          web: "content_copy",
        } as const,
        onSelect: onDuplicate,
      },
      {
        id: "repeat",
        title: repeat.label,
        icon: { ios: "repeat", android: "repeat", web: "repeat" } as const,
        onSelect: repeat.onSelect,
      },
      {
        id: "delete",
        title: "Delete",
        icon: { ios: "trash", android: "delete", web: "delete" } as const,
        isDestructive: true,
        onSelect: onDelete,
      },
    ],
  },
];
