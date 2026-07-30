import { useMemo } from "react";
import { StyleSheet, Text } from "react-native";

import { buildExcerpt } from "@/utils/searchHighlight";
import { useTheme, withOpacity } from "@/utils/theme";

type THighlightedExcerptProps = {
  /** The full matched text — this component does the windowing itself. */
  text: string;
  /** The search query, whose terms get marked. */
  query: string;
  numberOfLines?: number;
};

/**
 * An excerpt of `text` around its first match on `query`, with the matching
 * terms marked (DEX-47).
 *
 * Nested `<Text>` runs rather than a row of sibling views: only nested text
 * flows and wraps as one paragraph, so a highlight can sit mid-line and the
 * `numberOfLines` clamp still applies to the excerpt as a whole.
 */
export function HighlightedExcerpt({
  text,
  query,
  numberOfLines = 3,
}: THighlightedExcerptProps) {
  const theme = useTheme();
  // Memoized because the inputs are whole notes: `buildExcerpt` regex-replaces
  // and lowercases the entire text to produce ~160 characters of output, and
  // this renders once per visible result row.
  const segments = useMemo(() => buildExcerpt(text, query), [text, query]);

  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        theme.fonts.body,
        styles.excerpt,
        { color: theme.colors.textSecondary },
      ]}
    >
      {segments.map((segment, index) => (
        <Text
          // Segments have no identity of their own — they're derived from the
          // text and the query, and the whole list is rebuilt whenever either
          // changes, so position is the only stable key available.
          key={index}
          style={
            segment.match
              ? [
                  styles.match,
                  {
                    color: theme.colors.text,
                    backgroundColor: withOpacity(theme.colors.primary, 0.25),
                  },
                ]
              : undefined
          }
        >
          {segment.text}
        </Text>
      ))}
    </Text>
  );
}

const styles = StyleSheet.create({
  excerpt: {
    lineHeight: 20,
  },
  match: {
    fontWeight: "600",
  },
});
