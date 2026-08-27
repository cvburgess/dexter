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
 * Words beside each figure; the reading order is `BACKLOG_COUNT_ORDER`, stated
 * once so it can't disagree with `defaultBacklogFilter`.
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
 * Split out for the seeding: the parent renders this only once tasks resolve,
 * so the lazy initializer never sees `useTasks`'s empty placeholder array.
 */
function BacklogList({ date, counts }: TBacklogListProps) {
  const [chosenFilter, setChosenFilter] = useState(() =>
    defaultBacklogFilter(counts),
  );

  // Written back, not derived — a refilled bucket must not yank the list off
  // the reader's position. Can't loop: an advance always lands non-empty.
  const shownFilter = nextBacklogFilter(chosenFilter, counts);
  if (shownFilter !== chosenFilter) setChosenFilter(shownFilter);

  return (
    <TaskDrawer
      date={date}
      filterId={shownFilter}
      onFilterChange={setChosenFilter}
      // Not a place to hunt for a known task, and the field cost the hero a
      // line of height (DEX-141).
      showSearch={false}
      // Liquid glass can't sample through the two animated opacities above
      // this drawer, leaving each row's "+" a bare glyph (DEX-150).
      solid
    />
  );
}

type TBacklogStepProps = {
  /** The day being walked through — the ritual's date, not necessarily today. */
  date: Temporal.PlainDate;
};

/**
 * The morning Backlog step (DEX-141): counts and drawer read the one
 * `useTasks()` query, so clearing a task drops both in the same render.
 */
export function BacklogStep({ date }: TBacklogStepProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [allTasks, { isLoading }] = useTasks();

  // Counts anchor to today (TaskDrawer filters against today whichever day is
  // shown) while the scope stays the ritual's day, matching the drawer's.
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

  // Figures carry the color, words stay in ink (CalendarStep's convention);
  // a zero reads as `success`, not an alarm.
  const figureColor = (key: keyof TBacklogCounts, count: number): string => {
    if (count === 0) return theme.colors.success;
    // priority[0] doubles as the missing "warning" token: due soon is a
    // heads-up, not the failure the other two are.
    return key === "dueSoon"
      ? theme.colors.priority[ETaskPriority.IMPORTANT_AND_URGENT]
      : theme.colors.error;
  };

  // The all-clear state is these same three lines, not separate copy — a state
  // change that also re-shaped the text would read as a different screen.
  const heroLines: THeroLine[] = BACKLOG_COUNT_ORDER.map((key) => ({
    key,
    figure: String(counts[key]),
    words: `${counts[key] === 1 ? "task" : "tasks"} ${HERO_LABELS[key]}`,
    color: figureColor(key, counts[key]),
  }));

  // Checked before the all-clear: the placeholder array makes every count zero
  // on a cold open, which would flash "0 left behind" at a full backlog.
  if (isLoading) return null;

  if (total === 0) {
    return (
      <View
        style={[
          styles.allClear,
          {
            // The host SafeAreaView omits the bottom edge, so centering in
            // the full box would sit this visibly low (as EmptyScreen does).
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
      {/* TaskDrawer pads itself by `md`; handed over so HeroLines can take it
          back off its own bottom padding instead of the two stacking. */}
      <HeroLines
        bodyInsetTop={theme.space.md}
        lines={heroLines}
        reveal={reveal}
      />
      {/* flex: 1 gives TaskDrawer's own flex root something to fill. Opacity
          only — SwipeablePage already slides, and two axes drift diagonally. */}
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
