import { Temporal } from "@js-temporal/polyfill";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import { ETaskPriority, TTask } from "@/api/tasks";
import { isTaskTemplate, NEW_TEMPLATE } from "@/api/templates";
import { useFocusTimer } from "@/hooks/useFocusTimer";
import { useTemplates } from "@/hooks/useTemplates";
import { formatMonthDayYear } from "@/utils/formatPlainDate";
import { openUrl } from "@/utils/openUrl";
import { isCompletionStatus } from "@/utils/taskFilters";
import { Theme, useTheme } from "@/utils/theme";
import { weekStartEnd } from "@/utils/weekStartEnd";

import { IconMenu, TIconMenuOption, TIconMenuSection } from "./IconMenu";
import { PRIORITY_OPTIONS, priorityIconColor } from "./PriorityControl";

type TMoreMenuProps = {
  task: TTask;
  onChangePriority: (priority: ETaskPriority) => void;
  onChangeSchedule: (scheduledFor: string | null) => void;
  onAddSubtask?: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

// Deliberately short (DEX-98): a menu row whose only job is opening a picker
// is a detour, not a shortcut — anything needing one lives in the edit modal.
export function MoreMenu({
  task,
  onChangePriority,
  onChangeSchedule,
  onAddSubtask,
  onDuplicate,
  onDelete,
  children,
  style,
}: TMoreMenuProps) {
  const theme = useTheme();
  const router = useRouter();
  const [, { getTemplateById }] = useTemplates();
  // Module store, not useLiveFocusBlock — this renders once per card, and a
  // query plus two mutation observers per row is too much for one shared value.
  const { actions: focusActions, block: liveFocusBlock } = useFocusTimer();

  // DEX-49: while another task's block runs, this row is simply absent —
  // "Start" there would silently cancel a block with no confirmation to render.
  const focusAction = (() => {
    if (isCompletionStatus(task.status)) return undefined;
    if (!liveFocusBlock) {
      return {
        title: "Start focus block",
        onSelect: () => focusActions.startFocusBlock(task.id),
      };
    }
    if (liveFocusBlock.taskId === task.id) {
      return {
        title: "Stop focus block",
        onSelect: () => focusActions.cancelFocusBlock(liveFocusBlock),
      };
    }
    return undefined;
  })();

  // withAnchor carries the tasks stack's list along on first entry, so the
  // modal always has it beneath to render over and close back to.
  const openTemplateEditor = (params: { id: string; [key: string]: string }) =>
    router.push(
      { pathname: "/settings/tasks/[id]", params },
      { withAnchor: true },
    );

  // Opens an unsaved draft seeded from the task, not a written-then-edited
  // row, so ✕ leaves nothing behind; navigates synchronously to avoid a race.
  const openDraftFromTask = (repeats: boolean) =>
    openTemplateEditor({
      id: NEW_TEMPLATE,
      fromTask: task.id,
      ...(repeats && { repeats: "1" }),
    });

  // No withAnchor — this route is on the root (app) stack, already inside
  // the tab navigator, so the push has the app beneath it.
  const openTaskEditor = () =>
    router.push({ pathname: "/edit-task/[id]", params: { id: task.id } });

  // templateId, not the lookup, decides whether there's anything to make — an
  // unresolved lookup means the query hasn't landed, not that it's scheduleless.
  const templateId = task.templateId;
  const linkedTemplate = getTemplateById(templateId);
  const templateAction: TTemplateMenuAction = templateId
    ? {
        kind:
          linkedTemplate && isTaskTemplate(linkedTemplate)
            ? "template"
            : "repeat",
        onEdit: () => openTemplateEditor({ id: templateId }),
      }
    : {
        kind: "unlinked",
        onRepeat: () => openDraftFromTask(true),
        onSaveAsTemplate: () => openDraftFromTask(false),
      };

  const editSections = [
    ...getPrioritySections(task.priority, onChangePriority, theme),
    ...getScheduleSections(task.scheduledFor, onChangeSchedule, openTaskEditor),
    ...getTaskActionSections(onAddSubtask, focusAction),
    // Always renders (unlike the optional checklist section above), so this
    // group can never be empty.
    {
      options: [
        {
          id: "edit-task",
          title: "Edit task",
          icon: EDIT_TASK_ICON,
          onSelect: openTaskEditor,
        },
      ],
    },
  ];

  // Set apart from the edit shortcuts (DEX-66) — it's the one action that
  // leaves the app. Absent when the task has no link.
  const url = task.url;
  const linkSections: TIconMenuSection[] = url
    ? [
        {
          options: [
            {
              id: "go-to-link",
              title: "Go to link",
              icon: LINK_ICON,
              onSelect: () => openUrl(url),
            },
          ],
        },
      ]
    : [];

  const sections = [
    ...linkSections,
    // Every section but the first gets hideDivider — otherwise IconMenu.native
    // draws each as its own separated group instead of one continuous list.
    ...editSections.map((section, index) => ({
      ...section,
      hideDivider: index !== 0,
    })),
    ...getOtherSections({
      onDuplicate,
      template: templateAction,
      onDelete,
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

const EDIT_TASK_ICON = {
  sf: "square.and.pencil",
  ionicon: "create-outline",
} as const;

const LINK_ICON = {
  sf: "link",
  ionicon: "link-outline",
} as const;

export const getPrioritySections = (
  priority: ETaskPriority,
  onChangePriority: (priority: ETaskPriority) => void,
  theme: Theme,
): TIconMenuSection[] => [
  {
    title: "Priority",
    icon: { sf: "exclamationmark", ionicon: "alert-outline" },
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

const SCHEDULE_ICON = {
  sf: "calendar",
  ionicon: "calendar-outline",
} as const;

// Ids stay namespaced — IconMenu.native flattens every section into one id
// map, so an un-namespaced date id would collide with a future section's.
export const getScheduleSections = (
  scheduledFor: string | null,
  onChangeSchedule: (scheduledFor: string | null) => void,
  onEditTask: () => void,
): TIconMenuSection[] => {
  const optionId = (suffix: string) => `schedule-${suffix}`;
  const now = Temporal.Now.plainDateISO();
  const today = now.toString();
  const tomorrow = now.add({ days: 1 }).toString();
  const { monday } = weekStartEnd(1);
  const nextMonday = monday.toString();

  const currentDate = scheduledFor
    ? Temporal.PlainDate.from(scheduledFor)
    : null;
  const isWithinNextWeek =
    currentDate !== null &&
    currentDate.until(monday).days <= 0 &&
    currentDate.until(monday).days >= -6;

  const options = [
    {
      id: optionId(today),
      title: "Today",
      isSelected: scheduledFor === today,
      onSelect: () => onChangeSchedule(today),
    },
    {
      id: optionId(tomorrow),
      title: "Tomorrow",
      isSelected: scheduledFor === tomorrow,
      onSelect: () => onChangeSchedule(tomorrow),
    },
  ];

  if (!isWithinNextWeek && tomorrow !== nextMonday) {
    options.push({
      id: optionId(nextMonday),
      title: "Next Week",
      isSelected: false,
      onSelect: () => onChangeSchedule(nextMonday),
    });
  }

  // Selecting the already-set date opens the editor (DEX-87), not the no-op
  // row it used to be.
  if (currentDate && scheduledFor !== today && scheduledFor !== tomorrow) {
    options.push({
      id: optionId(currentDate.toString()),
      title: formatMonthDayYear(currentDate),
      isSelected: true,
      onSelect: onEditTask,
    });
  }

  // Any other day is a form field, not a menu row (DEX-98).
  options.push({
    id: optionId("pick-date"),
    title: "Pick a date…",
    isSelected: false,
    onSelect: onEditTask,
  });

  if (currentDate) {
    options.push({
      id: optionId("clear"),
      title: "Unschedule",
      isSelected: false,
      onSelect: () => onChangeSchedule(null),
    });
  }

  return [
    {
      title: "Schedule",
      icon: SCHEDULE_ICON,
      isSubmenu: true,
      options,
    },
  ];
};

// Acts on the task's contents, not the task as a whole; optional, so the
// section drops out where a checklist can't be added.
export const getTaskActionSections = (
  onAddSubtask?: () => void,
  focus?: { title: string; onSelect: () => void },
): TIconMenuSection[] => {
  const options: TIconMenuOption[] = [];

  if (focus) {
    options.push({
      id: "focus-block",
      title: focus.title,
      icon: { sf: "timer", ionicon: "timer-outline" } as const,
      onSelect: focus.onSelect,
    });
  }

  if (onAddSubtask) {
    options.push({
      id: "add-subtask",
      title: "Add subtask",
      icon: { sf: "checklist", ionicon: "list-outline" } as const,
      onSelect: onAddSubtask,
    });
  }

  return options.length ? [{ options }] : [];
};

// A task already belonging to a template gets exactly one item — edit it;
// only an unlinked task can make one, in either kind (DEX-65).
export type TTemplateMenuAction =
  | { kind: "unlinked"; onRepeat: () => void; onSaveAsTemplate: () => void }
  | { kind: "repeat"; onEdit: () => void }
  | { kind: "template"; onEdit: () => void };

const REPEAT_ICON = {
  sf: "repeat",
  ionicon: "repeat",
} as const;

// Same SF Symbol for both template rows, so saving and editing read as the
// same object; Material has no equivalent, so it splits across a bookmark pair.
const SAVE_TEMPLATE_ICON = {
  sf: "square.on.square.dashed",
  ionicon: "bookmark-outline",
} as const;

const EDIT_TEMPLATE_ICON = {
  sf: "square.on.square.dashed",
  ionicon: "bookmark",
} as const;

// Ids stay distinct per kind even though only one renders at a time —
// IconMenu.native dispatches by id, so a shared id is ambiguous to tests.
const getTemplateOptions = (action: TTemplateMenuAction): TIconMenuOption[] => {
  switch (action.kind) {
    case "unlinked":
      return [
        {
          id: "repeat",
          title: "Repeat",
          icon: REPEAT_ICON,
          onSelect: action.onRepeat,
        },
        {
          id: "save-as-template",
          title: "Save as template",
          icon: SAVE_TEMPLATE_ICON,
          onSelect: action.onSaveAsTemplate,
        },
      ];
    case "repeat":
      return [
        {
          id: "edit-repeat",
          title: "Edit repeat schedule",
          icon: REPEAT_ICON,
          onSelect: action.onEdit,
        },
      ];
    case "template":
      return [
        {
          id: "edit-template",
          title: "Edit template",
          icon: EDIT_TEMPLATE_ICON,
          onSelect: action.onEdit,
        },
      ];
  }
};

// Untitled — the icons and labels say it. Delete is marked destructive.
export const getOtherSections = ({
  onDuplicate,
  template,
  onDelete,
}: {
  onDuplicate: () => void;
  template: TTemplateMenuAction;
  onDelete: () => void;
}): TIconMenuSection[] => [
  {
    options: [
      {
        id: "duplicate",
        title: "Duplicate",
        icon: { sf: "plus.square.on.square", ionicon: "copy-outline" } as const,
        onSelect: onDuplicate,
      },
      ...getTemplateOptions(template),
      {
        id: "delete",
        title: "Delete",
        icon: { sf: "trash", ionicon: "trash-outline" } as const,
        isDestructive: true,
        onSelect: onDelete,
      },
    ],
  },
];
