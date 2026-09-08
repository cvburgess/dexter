import type { HeadingLevel, StyleState } from "react-native-enriched-markdown";

/** Deepest level the cycling heading button reaches before turning off. */
const MAX_CYCLE_LEVEL: HeadingLevel = 3;

/**
 * The level to pass to `toggleHeading`. Passing the level already applied
 * turns the heading off, which is how the cycle ends.
 */
export function nextHeadingLevel(state: StyleState | null): HeadingLevel {
  const { isActive, level } = state?.heading ?? { isActive: false, level: 1 };
  if (!isActive) return 1;
  // A level past the cycle only arrives from pasted markdown; repeat it to
  // clear rather than stepping the user down through levels they never chose.
  if (level >= MAX_CYCLE_LEVEL) return level;
  return (level + 1) as HeadingLevel;
}

/** What the heading button reads: its level when set, a bare `H` when not. */
export function headingLabel(state: StyleState | null): string {
  const heading = state?.heading;
  return heading?.isActive ? `H${heading.level}` : "H";
}

/** Indent and outdent only mean anything inside a list, so they only show there. */
export function isListActive(state: StyleState | null): boolean {
  return Boolean(state?.unorderedList.isActive || state?.orderedList.isActive);
}
