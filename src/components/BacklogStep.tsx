import { Temporal } from "@js-temporal/polyfill";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";

import { ETaskPriority } from "@/api/tasks";
import {
  BODY_STAGE,
  HeroLines,
  type THeroLine,
  useHeroReveal,
  useStageOpacity,
} from "@/components/HeroLines";
import { TaskDrawer } from "@/components/TaskDrawer";
import { useTasks } from "@/hooks/useTasks";
import { useToday } from "@/hooks/useToday";
import {
  BACKLOG_COUNT_ORDER,
  backlogCounts,
  defaultBacklogFilter,
  nextBacklogFilter,
  selectBacklogTasks,
  TBacklogCounts,
} from "@/utils/taskFilters";
import { useTheme } from "@/utils/theme";

/**
 * The words beside each figure. The *order* the lines read in is
 * `BACKLOG_COUNT_ORDER`, not this — it is the same decision as the order
 * `defaultBacklogFilter` picks the opening filter in, so it is stated once.
 */
const HERO_LABELS: Record<keyof TBacklogCounts, string> = {
  leftBehind: "left behind",
  overdue: "overdue",
  dueSoon: "due soon",
};

type TBacklogListProps = {
  /** The day a row's "+" schedules its task onto. */
  date: Temporal.PlainDate;
  /** The counts as they stand — the opening preset is read off the first. */
  counts: TBacklogCounts;
};

/**
 * The drawer half of the step, split out for the seeding: its parent renders it
 * only once the tasks have resolved *and* something needs attention, so the
 * lazy initializer below never sees `useTasks`'s empty placeholder array.
 *
 * State holds where the reader is; `nextBacklogFilter` moves them on once the
 * bucket they are looking at empties and leaves them alone while it hasn't —
 * see that function for why emptiness is the only thing allowed to move it.
 */
function BacklogList({ date, counts }: TBacklogListProps) {
  const [chosenFilter, setChosenFilter] = useState(() =>
    defaultBacklogFilter(counts),
  );

  // An advance *is* the reader's new position, so it has to be recorded rather
  // than only derived. Left in state, the emptied bucket would still be the one
  // `nextBacklogFilter` reads: refill it — un-complete a task from the drawer,
  // or take a change from another device — and it would count as non-empty
  // again and yank the list back off whatever the reader had moved on to,
  // which is the one thing this filter must never do.
  //
  // Adjusted during render (React's supported pattern for deriving state from a
  // changed input, as `ritual/index.tsx` and `today/index.tsx` do) rather than
  // in an effect, so the drawer never renders the stale preset for a frame
  // first. It cannot loop: the advance always lands on a bucket with tasks in
  // it, which `nextBacklogFilter` then returns unchanged.
  const shownFilter = nextBacklogFilter(chosenFilter, counts);
  if (shownFilter !== chosenFilter) setChosenFilter(shownFilter);

  return (
    <TaskDrawer
      date={date}
      filterId={shownFilter}
      onFilterChange={setChosenFilter}
      // The step walks the reader down a short list of what is slipping; it is
      // not where you go to hunt for a task you already have in mind, and the
      // field cost the hero a line of height for it (DEX-141).
      showSearch={false}
      // This drawer sits under two animated opacities — the step's own
      // `<Animated.View style={drawerStyle}>` below, and `SwipeablePage`'s
      // intro over every ritual step — which liquid glass cannot sample
      // through, leaving each row's "+" a bare glyph (DEX-150).
      solid
    />
  );
}

type TBacklogStepProps = {
  /** The day being walked through — the ritual's date, not necessarily today. */
  date: Temporal.PlainDate;
};

/**
 * The morning ritual's Backlog step (DEX-141): what is slipping, counted, over
 * the same backlog drawer the Today tab docks.
 *
 * The counts and the drawer read the one `useTasks()` query and share a scope,
 * so scheduling a task onto the ritual's day drops it from the hero and the
 * list in the same render — which is the whole interaction here: the numbers go
 * down as you clear them.
 *
 * Carries no side gutter and no top inset of its own; `SwipeablePage` and the
 * ritual layouts own those (see docs/design.md, "Who owns spacing").
 */
export function BacklogStep({ date }: TBacklogStepProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [allTasks, { isLoading }] = useTasks();

  // Anchored to today rather than to `date`: `TaskDrawer` filters against today
  // whichever day the header is on, and a hero that disagreed with the list
  // under it would be worse than no hero. The *scope* is the ritual's day,
  // though — the same `[date]` the drawer defaults to — so a task scheduled
  // onto today's ritual leaves both at once.
  const today = useToday();
  const counts = useMemo(
    () => backlogCounts(selectBacklogTasks(allTasks, [date]), today),
    [allTasks, date, today],
  );
  const total = counts.leftBehind + counts.overdue + counts.dueSoon;

  // Held back until the counts exist, so the sequence waits rather than running
  // against `useTasks`'s empty placeholder array.
  const reveal = useHeroReveal(isLoading ? null : date.toString());
  const drawerStyle = useStageOpacity(reveal, BODY_STAGE);

  // The figure carries the color and the words stay in ink — the convention
  // `CalendarStep` set for its own split line. Coloring the words too reads as
  // three warnings rather than as three readings of one backlog. A zero is a
  // result worth stating in `success` rather than a count worth alarming about,
  // whichever line it lands on.
  const figureColor = (key: keyof TBacklogCounts, count: number): string => {
    if (count === 0) return theme.colors.success;
    // `priority[0]` is the daisyUI "warning" token (there is no dedicated
    // `warning` color — see `Theme.colors.priority` in `theme.ts`), which is
    // what "the same as urgent+important" means: due soon is a heads-up, not
    // the failure the other two are.
    return key === "dueSoon"
      ? theme.colors.priority[ETaskPriority.IMPORTANT_AND_URGENT]
      : theme.colors.error;
  };

  // Shared by both branches below: the all-clear state is these same three
  // lines, laid out and staggered identically, rather than separate copy — a
  // zero on every line is already the good news, and a state change that also
  // re-shaped the text would read as a different screen.
  const heroLines: THeroLine[] = BACKLOG_COUNT_ORDER.map((key) => ({
    key,
    figure: String(counts[key]),
    words: `${counts[key] === 1 ? "task" : "tasks"} ${HERO_LABELS[key]}`,
    color: figureColor(key, counts[key]),
  }));

  // Checked *first*, and the order is load-bearing: `useTasks` hands back an
  // empty placeholder array while the query resolves, so every count is zero on
  // a cold open — testing the all-clear state ahead of this would flash "0
  // tasks left behind" at someone whose backlog is full. Nothing rather than a
  // spinner, for the same reason the calendar step shows nothing: one quick
  // read, and a spinner that appears for a frame reads as the step failing.
  if (isLoading) return null;

  if (total === 0) {
    return (
      <View
        style={[
          styles.allClear,
          {
            // The host SafeAreaView omits the bottom edge (the tab bar owns
            // it), so centering in the full box would sit this visibly low —
            // the same reservation `EmptyScreen` and the calendar step's
            // clear-day block make. `HeroLines` brings the padding itself.
            paddingBottom: insets.bottom,
          },
        ]}
        testID="backlog-step-clear"
      >
        <HeroLines lines={heroLines} reveal={reveal} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* `TaskDrawer` pads itself by `md`, which lands under the hero — handed
          over so the block can take it back off its own bottom padding rather
          than the two stacking into a gap wider than the space above. */}
      <HeroLines
        bodyInsetTop={theme.space.md}
        lines={heroLines}
        reveal={reveal}
      />
      {/* `flex: 1` belongs to this wrapper: `TaskDrawer` bounds its FlashList to
          its own `flex: 1` root, and an `Animated.View` sized to its content
          would give it nothing to fill. Opacity only, no translate —
          `SwipeablePage`'s intro already slides the page, and a second axis
          compounds into a diagonal drift. */}
      <Animated.View style={[styles.drawer, drawerStyle]}>
        <BacklogList counts={counts} date={date} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // No gap: `HeroLines` owns the space under the hero, and `TaskDrawer` its own
  // `md` padding above the controls.
  container: { flex: 1 },
  drawer: { flex: 1 },
  allClear: {
    flex: 1,
    justifyContent: "center",
  },
});
