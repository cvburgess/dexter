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
import type { TTaskDateField } from "./SetDateModal";

type TMoreMenuProps = {
  task: TTask;
  onChangePriority: (priority: ETaskPriority) => void;
  onChangeSchedule: (scheduledFor: string | null) => void;
  onChangeDeadline: (dueOn: string | null) => void;
  onChangeList: (listId: string | null) => void;
  /** Opens the date picker for the named field, seeded to its current value. */
  onPickDate: (field: TTaskDateField) => void;
  onSetAlarm: () => void;
  onClearAlarm: () => void;
  onAddSubtask?: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Wraps `children` (the whole task card) with a long-press menu for priority, schedule, deadline, list, and task actions. */
export function MoreMenu({
  task,
  onChangePriority,
  onChangeSchedule,
  onChangeDeadline,
  onChangeList,
  onPickDate,
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

  // Alarms ring via native iOS AlarmKit only, so the item is iOS-only. A single
  // directly-tappable action, not a submenu.
  const alarm = isAlarmSupported
    ? {
        title: task.alarmTime ? "Unset alarm" : "Set alarm",
        onSelect: task.alarmTime ? onClearAlarm : onSetAlarm,
      }
    : undefined;

  // Everything that edits the task: what it is, when it happens, where it
  // lives, and what it contains. One unruled group, however many sections it
  // takes to build — only the actions below it are set apart.
  const editSections = [
    ...getPrioritySections(task.priority, onChangePriority, theme),
    ...getScheduleSections(task.scheduledFor, onChangeSchedule, () =>
      onPickDate("schedule"),
    ),
    ...getDeadlineSections(task.dueOn, onChangeDeadline, () =>
      onPickDate("deadline"),
    ),
    // ListButton's sections, collapsed into a titled submenu like the others.
    ...getListSections(lists, task.listId, onChangeList).map((section) => ({
      ...section,
      title: "List",
      icon: { ios: "face.smiling", android: "mood", web: "mood" } as const,
      isSubmenu: true,
    })),
    ...getTaskActionSections(alarm, onAddSubtask),
  ];

  const sections = [
    ...editSections.map((section, index) =>
      index === 0 ? section : { ...section, hideDivider: true },
    ),
    ...getOtherSections(onDuplicate, onDelete, {
      label: isRepeating ? "Edit repeat schedule" : "Repeat",
      onSelect: onRepeat,
    }),
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

/**
 * The two date submenus differ only in their copy and icon — the presets, the
 * "Pick a date…" row, and the rule for when a custom date or a clear action
 * appears are identical.
 */
const DATE_FIELD_META = {
  schedule: {
    title: "Schedule",
    icon: {
      ios: "calendar",
      android: "calendar_today",
      web: "calendar_today",
    },
    clearId: "unschedule",
    clearTitle: "Unschedule",
  },
  deadline: {
    title: "Deadline",
    icon: { ios: "flag", android: "flag", web: "flag" },
    clearId: "clear-deadline",
    clearTitle: "Clear deadline",
  },
} as const;

const getDateSections = (
  field: TTaskDateField,
  value: string | null,
  onChange: (value: string | null) => void,
  onPickDate: () => void,
): TIconMenuSection[] => {
  const meta = DATE_FIELD_META[field];
  const today = Temporal.Now.plainDateISO().toString();
  const tomorrow = Temporal.Now.plainDateISO().add({ days: 1 }).toString();
  const { monday } = weekStartEnd(1);
  const nextMonday = monday.toString();

  const currentDate = value ? Temporal.PlainDate.from(value) : null;
  const isWithinNextWeek =
    currentDate !== null &&
    currentDate.until(monday).days <= 0 &&
    currentDate.until(monday).days >= -6;

  const options = [
    {
      id: today,
      title: "Today",
      isSelected: value === today,
      onSelect: () => onChange(today),
    },
    {
      id: tomorrow,
      title: "Tomorrow",
      isSelected: value === tomorrow,
      onSelect: () => onChange(tomorrow),
    },
  ];

  if (!isWithinNextWeek && tomorrow !== nextMonday) {
    options.push({
      id: nextMonday,
      title: "Next Week",
      isSelected: false,
      onSelect: () => onChange(nextMonday),
    });
  }

  // The date already set, when it isn't one of the presets above. Selecting it
  // opens the picker seeded to it — a way *into* the calendar rather than the
  // no-op row it used to be (DEX-87).
  if (currentDate && value !== today && value !== tomorrow) {
    options.push({
      id: currentDate.toString(),
      title: formatMonthDayYear(currentDate),
      isSelected: true,
      onSelect: onPickDate,
    });
  }

  options.push({
    id: "pick-date",
    title: "Pick a date…",
    isSelected: false,
    onSelect: onPickDate,
  });

  if (currentDate) {
    options.push({
      id: meta.clearId,
      title: meta.clearTitle,
      isSelected: false,
      onSelect: () => onChange(null),
    });
  }

  return [
    {
      title: meta.title,
      icon: meta.icon,
      isSubmenu: true,
      options,
    },
  ];
};

export const getScheduleSections = (
  scheduledFor: string | null,
  onChangeSchedule: (scheduledFor: string | null) => void,
  onPickDate: () => void,
): TIconMenuSection[] =>
  getDateSections("schedule", scheduledFor, onChangeSchedule, onPickDate);

export const getDeadlineSections = (
  dueOn: string | null,
  onChangeDeadline: (dueOn: string | null) => void,
  onPickDate: () => void,
): TIconMenuSection[] =>
  getDateSections("deadline", dueOn, onChangeDeadline, onPickDate);

/**
 * Task-management actions, rendered as an inline "Other" group so the actions
 * are directly tappable rather than nested in a submenu. The optional alarm
 * toggle leads the group (iOS-only — AlarmKit does the ringing, DEX-48); it
 * flips between "Set alarm" and "Unset alarm" but keeps the same icon either
 * way. Duplicate / Repeat / Delete follow; the repeat item's label reflects
 * whether the task already has a repeat schedule, and Delete is marked
 * destructive so `IconMenu` styles it accordingly.
 */
/**
 * The two edits that act on the task itself, rather than on the task as a whole
 * the way the actions below them do: copy it, repeat it, delete it.
 *
 * Both are optional (alarms are iOS-only; subtasks are only offered where a
 * checklist can be added), so the section drops out entirely when neither is.
 */
export const getTaskActionSections = (
  alarm?: { title: string; onSelect: () => void },
  onAddSubtask?: () => void,
): TIconMenuSection[] => {
  const options = [
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
  ];

  return options.length > 0 ? [{ options }] : [];
};

/** Duplicate/Repeat/Delete: untitled, because the icons and labels say it. */
export const getOtherSections = (
  onDuplicate: () => void,
  onDelete: () => void,
  repeat: { label: string; onSelect: () => void },
): TIconMenuSection[] => [
  {
    options: [
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
