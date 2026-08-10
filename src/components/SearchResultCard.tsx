import { Temporal } from "@js-temporal/polyfill";
import { Pressable, StyleSheet, Text } from "react-native";

import { HighlightedExcerpt } from "@/components/HighlightedExcerpt";
import { formatMonthDayYear } from "@/utils/formatPlainDate";
import { useTheme } from "@/utils/theme";

type TSearchResultCardProps = {
  /** ISO date (YYYY-MM-DD) of the day the entry belongs to. */
  date: string;
  /** The journal question this entry answered; omitted for a note. */
  prompt?: string;
  /** The full matched text — `HighlightedExcerpt` windows it. */
  content: string;
  /** The search query, whose terms get marked in the excerpt. */
  query: string;
  /**
   * Omitted for a result with nowhere to open — a journal entry while the
   * journal is disabled (see `canOpenSearchResult`). The card still renders its
   * excerpt; it just isn't a link, matching how `TaskCard` drops its `onPress`
   * for a completed unscheduled task.
   */
  onPress?: () => void;
};

/**
 * A note or journal search result (DEX-47): the day it belongs to, the journal
 * prompt when there is one, and an excerpt with the matching terms marked.
 *
 * Tasks don't use this — they render the real `TaskCard`, so a result looks the
 * same as it does in the day's list.
 */
export function SearchResultCard({
  date,
  prompt,
  content,
  query,
  onPress,
}: TSearchResultCardProps) {
  const theme = useTheme();
  // The date is the result's identity here (unlike a task, which has a title),
  // so it carries the year — a search reaches back further than the day nav does.
  const label = formatMonthDayYear(Temporal.PlainDate.from(date));

  return (
    <Pressable
      // Not a button when there is nowhere to go — announcing one that does
      // nothing is worse than announcing the text itself.
      accessibilityRole={onPress ? "button" : undefined}
      // Names the destination rather than reading out the excerpt, which the
      // Text below already exposes.
      accessibilityLabel={prompt ? `${prompt}, ${label}` : label}
      disabled={!onPress}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surfaceSunken,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.md,
          gap: theme.space.xs,
          padding: theme.space.sm,
        },
      ]}
    >
      <Text
        style={[
          theme.fonts.subtitle,
          styles.date,
          { color: theme.colors.textSecondary },
        ]}
      >
        {label}
      </Text>
      {prompt ? (
        <Text style={[theme.fonts.title, { color: theme.colors.text }]}>
          {prompt}
        </Text>
      ) : null}
      <HighlightedExcerpt text={content} query={query} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  date: {
    textTransform: "uppercase",
  },
});
