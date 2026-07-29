import { Temporal } from "@js-temporal/polyfill";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import { ETaskPriority, TTask } from "@/api/tasks";
import { isTaskTemplate, NEW_TEMPLATE } from "@/api/templates";
import { useTemplates } from "@/hooks/useTemplates";
import { formatMonthDayYear } from "@/utils/formatPlainDate";
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

/**
 * Wraps `children` (the whole task card) with a long-press menu.
 *
 * Deliberately short. Everything that needs a picker to change — the list, the
 * deadline, the alarm, an arbitrary date — lives in the edit modal, which this
 * menu's first item opens; a menu row whose only job was to launch a sheet was
 * a detour, not a shortcut (DEX-98). What stays is what a single tap can
 * finish: priority, the schedule presets, and the task-level actions.
 */
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

  // One editor for all three entry points: it shows a repeat schedule, a saved
  // template, or an unsaved draft depending on the route it is opened at.
  //
  // `withAnchor` carries the tasks stack's anchor — its list — along when this
  // push enters that navigator for the first time, so the modal always has the
  // list beneath it to render over and close back to (see `tasks/_layout.tsx`).
  const openTemplateEditor = (params: { id: string; [key: string]: string }) =>
    router.push(
      { pathname: "/settings/tasks/[id]", params },
      { withAnchor: true },
    );

  /**
   * Both menu items open an unsaved draft seeded from this task rather than
   * writing a row and then editing it, so nothing is stored until ✓ and ✕
   * leaves nothing behind. They differ only in the cadence the draft opens on.
   *
   * Navigating synchronously matters too: when these wrote first and pushed
   * from the mutation's callback, doing two in a row let the first one's late
   * callback push its editor over the second's.
   */
  const openDraftFromTask = (repeats: boolean) =>
    openTemplateEditor({
      id: NEW_TEMPLATE,
      fromTask: task.id,
      ...(repeats && { repeats: "1" }),
    });

  // No `withAnchor`: this route is declared on the root `(app)` stack (like
  // `new-task`), which the tab navigator already sits inside, so the push has
  // the app beneath it to render over and close back to.
  const openTaskEditor = () =>
    router.push({ pathname: "/edit-task/[id]", params: { id: task.id } });

  // `tasks.template_id` has one meaning — this task came from that template —
  // so it, and not the lookup, decides whether there is anything to make: a
  // task that already belongs to a template offers only the edit for it, and
  // never a second, orphaned copy. Bound to a local const so TS keeps the
  // narrowing inside the `onEdit` closure.
  //
  // The resolved row picks only the noun. An unresolved lookup means the
  // templates query hasn't landed yet, not that the row is scheduleless:
  // falling back to the template wording would relabel an established repeat
  // until the fetch settles. Both linked kinds open the same editor, so only
  // the noun is ever at stake, and nothing here is written.
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

  // Everything that edits the task: the full form, then the two changes quick
  // enough to be worth a tap of their own, then the checklist. One unruled
  // group, however many sections it takes to build — only the actions below it
  // are set apart.
  const editSections = [
    ...getEditTaskSections(openTaskEditor),
    ...getPrioritySections(task.priority, onChangePriority, theme),
    ...getScheduleSections(task.scheduledFor, onChangeSchedule, openTaskEditor),
    ...getTaskActionSections(onAddSubtask),
  ];

  const sections = [
    ...editSections.map((section, index) =>
      index === 0 ? section : { ...section, hideDivider: true },
    ),
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

/**
 * The way into every field at once, first in the menu — it is the general case
 * the rows beneath it are shortcuts for.
 */
export const getEditTaskSections = (
  onEditTask: () => void,
): TIconMenuSection[] => [
  {
    options: [
      {
        id: "edit-task",
        title: "Edit task",
        icon: {
          ios: "square.and.pencil",
          android: "edit_square",
          web: "edit_square",
        } as const,
        onSelect: onEditTask,
      },
    ],
  },
];

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

const SCHEDULE_ICON = {
  ios: "calendar",
  android: "calendar_today",
  web: "calendar_today",
} as const;

/**
 * The schedule submenu: the days worth a single tap, plus the two rows that
 * hand off to the edit modal for anything else.
 *
 * Option ids stay namespaced even though schedule is now the only date field
 * here — `IconMenu.native` flattens every section into one id -> option map
 * before handing the tree to the system menu, so an un-namespaced date id would
 * collide with any future section offering the same days.
 */
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

  // The date already set, when it isn't one of the presets above. Selecting it
  // opens the editor seeded to the task — a way *into* the date field rather
  // than the no-op row it used to be (DEX-87).
  if (currentDate && scheduledFor !== today && scheduledFor !== tomorrow) {
    options.push({
      id: optionId(currentDate.toString()),
      title: formatMonthDayYear(currentDate),
      isSelected: true,
      onSelect: onEditTask,
    });
  }

  // Any other day is a form field, not a menu row: the edit modal owns the
  // calendar, and opening it from here costs the same one tap the sheet did
  // while also putting every other field within reach (DEX-98).
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

/**
 * The one edit that acts on the task's contents rather than on the task as a
 * whole the way the actions below it do.
 *
 * Optional — subtasks are only offered where a checklist can be added — so the
 * section drops out entirely when it isn't.
 */
export const getTaskActionSections = (
  onAddSubtask?: () => void,
): TIconMenuSection[] =>
  onAddSubtask
    ? [
        {
          options: [
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
          ],
        },
      ]
    : [];

/**
 * What the menu offers for the template side of a task. A repeat task is just a
 * template that re-occurs automatically, and `tasks.template_id` says only
 * "this task came from that template" — so a task that already belongs to one
 * has nothing to choose between and gets exactly one item: edit the thing that
 * exists. Only a task belonging to no template can make one, in either kind
 * (DEX-65).
 */
export type TTemplateMenuAction =
  | { kind: "unlinked"; onRepeat: () => void; onSaveAsTemplate: () => void }
  | { kind: "repeat"; onEdit: () => void }
  | { kind: "template"; onEdit: () => void };

const REPEAT_ICON = {
  ios: "repeat",
  android: "repeat",
  web: "repeat",
} as const;

// `square.on.square.dashed` for both template rows, so saving one and later
// editing it read as the same object. Material has no single equivalent, so the
// two states split across its bookmark pair.
const SAVE_TEMPLATE_ICON = {
  ios: "square.on.square.dashed",
  android: "bookmark_add",
  web: "bookmark_add",
} as const;

const EDIT_TEMPLATE_ICON = {
  ios: "square.on.square.dashed",
  android: "bookmark",
  web: "bookmark",
} as const;

/**
 * The template rows, spliced between Duplicate and Delete. Ids stay distinct
 * per kind even though only one kind ever renders at a time — `IconMenu.native`
 * flattens every section into one id -> option map and dispatches by id, so a
 * shared id would make the tests (and any future consumer) unable to tell which
 * row it pressed.
 */
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

/**
 * Duplicate / the template rows / Delete: untitled, because the icons and
 * labels say it. Delete is marked destructive so `IconMenu` styles it
 * accordingly.
 */
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
        icon: {
          ios: "plus.square.on.square",
          android: "content_copy",
          web: "content_copy",
        } as const,
        onSelect: onDuplicate,
      },
      ...getTemplateOptions(template),
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
