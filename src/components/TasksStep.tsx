import { Temporal } from "@js-temporal/polyfill";
import { StyleSheet, Text } from "react-native";

import { DayTaskList } from "@/components/DayTaskList";
import { useTheme } from "@/utils/theme";

type TTasksStepProps = {
  /** The day being walked through — the ritual's date, not necessarily today. */
  date: Temporal.PlainDate;
};

/**
 * The morning ritual's Tasks step (DEX-144): what the day holds once the
 * backlog step before it has been cleared through.
 *
 * Deliberately the Today tab's own list rather than a ritual-specific one —
 * `DayTaskList` unmodified, which is what "same components, ordering, etc"
 * means concretely: contents come from `selectTasksForDate` against the one
 * `["tasks"]` cache, and the order is the server's
 * (status → priority → due date), so this step cannot drift from Today's.
 *
 * No `HabitTracker` (that is `TasksView`, the Today pane) and no `HeroLines` —
 * the two reporting steps before this one open with a hero because they are
 * summarizing something; this one is the list itself. Drag-to-schedule turns
 * itself off: `DraggableTaskCard` degrades to a plain `TaskCard` without a
 * `DragScheduleProvider` above it, and the Ritual tab has none.
 *
 * Carries no side gutter and no top inset of its own; `SwipeablePage` and the
 * ritual layouts own those (see docs/design.md, "Who owns spacing"), and
 * `DayTaskList` already reserves `insets.bottom` inside its own scroller.
 */
export function TasksStep({ date }: TTasksStepProps) {
  const theme = useTheme();

  return (
    <DayTaskList
      date={date}
      // "today" whichever day the header is on. The ritual can be paged to
      // another date (DEX-138), but it is a ritual *for* a day — the copy
      // speaks from inside that day rather than narrating which one it is, and
      // "this day" read as a form letter in the one place the app is meant to
      // sound like it is talking to you.
      emptyMessage="No tasks scheduled for today."
      emptyAction={
        <Text
          style={[
            styles.prompt,
            {
              ...theme.fonts.body,
              color: theme.colors.textSecondary,
              // `EmptyScreen` separates its children from the message by its
              // own in-group `sm`, which is less than a line — the prompt read
              // as a second half of the sentence above it rather than as the
              // thing to go and do. Tops it up to the group step, the same
              // arithmetic `TaskDrawer` uses for its control cluster (see
              // docs/design.md, "Spacing").
              marginTop: theme.space.lg - theme.space.sm,
            },
          ]}
        >
          {/* Names the global button rather than adding a second one — the
              issue's point. It is in the tab bar's bottom accessory on a phone
              (`NewTaskButton`) and the nav rail/dock elsewhere (`AppNav`), and
              `ritual/index.tsx`'s `usePublishViewedDay` already defaults it to
              the day on screen. */}
          Press “＋ New Task” to get started.
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  // `EmptyScreen` centers its own message but only `alignItems`-centers its
  // children, which centers the *box* — a prompt long enough to wrap (which
  // this one is, on a phone) would set its second line flush left under a
  // centered sentence.
  prompt: { textAlign: "center" },
});
