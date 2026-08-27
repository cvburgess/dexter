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

// Nested Text runs, not sibling views (DEX-47) — only nested text flows and
// wraps as one paragraph, so numberOfLines clamps the excerpt as a whole.
export function HighlightedExcerpt({
  text,
  query,
  numberOfLines = 3,
}: THighlightedExcerptProps) {
  const theme = useTheme();
  // Memoized — buildExcerpt regex-replaces the whole note for ~160 characters
  // of output, and this renders once per visible result row.
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
          // Position is the only stable key — segments have no identity of
          // their own, and the list rebuilds whenever text or query changes.
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
