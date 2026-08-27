import { StyleSheet, View } from "react-native";

import { Theme, useTheme } from "@/utils/theme";

// Derived once — if row and rail geometry drift apart, the line stops
// meeting the circles. TaskCard reads from here too, for its own padding.
export type TSubtaskGeometry = {
  /** Diameter of a subtask's status circle. */
  statusSize: number;
  /** Height of one row. Titles are single-line, so every row is exactly this tall. */
  rowHeight: number;
  /** Between rows. */
  gap: number;
  /** Padding, not margin, so the rail's first segment starts inside its box. */
  offset: number;
  /** The rows' left inset — what puts both columns of circles on the same axis. */
  inset: number;
};

// Row height matches the parent's inline control, circle three quarters of
// it, so the nesting reads at a glance on either density tier (DEX-61).
export const subtaskGeometry = (theme: Theme): TSubtaskGeometry => {
  const rowHeight = theme.controls.sm;
  const statusSize = Math.round(rowHeight * 0.75);

  return {
    statusSize,
    rowHeight,
    // Decorative, and deliberately not on the spacing scale: the rows read as
    // one stacked block, and anything wider separates them into cards.
    gap: 2,
    offset: theme.space.sm,
    inset: (rowHeight - statusSize) / 2,
  };
};

/** Matches StatusButton's `borderWidth`, so the rail reads as the same stroke
 * as the circles it joins (its color matches their border opacity too). */
const CONNECTOR_WIDTH = 1;

// Segments, not one continuous line — the circles are transparent, so a
// full-length rail would show straight through every one of them.
const connectorSegment = (
  index: number,
  offset: number,
  { statusSize, rowHeight, gap }: TSubtaskGeometry,
) => {
  const circleInset = (rowHeight - statusSize) / 2;
  const top = offset + index * (rowHeight + gap) + circleInset;
  // The parent's circle fills its row, so its underside is the checklist's top
  // edge; a sibling's clears the gap and its own inset first.
  const previousBottom = index === 0 ? 0 : top - gap - circleInset * 2;
  return { height: top - previousBottom, top: previousBottom };
};

type TSubtaskConnectorsProps = {
  count: number;
  color: string;
  /** Distance from the container's top edge to the first row (default geometry.offset). */
  offset?: number;
  /** The rows' left inset — absolutely positioned children need it stated
   * explicitly or the rail lands left of the circles (default geometry.inset). */
  inset?: number;
  /** Draw the segment above the first row — true on a card (links to the
   * parent), false in a form (the row above is a heading, not a task). */
  leading?: boolean;
};

// Absolutely positioned segments over a container that lays its rows out on
// subtaskGeometry: gap between rows, each rowHeight tall, statusSize circles.
export function SubtaskConnectors({
  count,
  color,
  offset,
  inset,
  leading = true,
}: TSubtaskConnectorsProps) {
  const geometry = subtaskGeometry(useTheme());
  // Each segment is named by the row it arrives at, so dropping the leading one
  // is dropping row 0's.
  const segments = Array.from({ length: count }, (_, index) => index).slice(
    leading ? 0 : 1,
  );
  const left = (inset ?? geometry.inset) + geometry.statusSize / 2;

  return (
    <>
      {segments.map((index) => (
        <View
          key={`connector-${index}`}
          style={[
            styles.connector,
            connectorSegment(index, offset ?? geometry.offset, geometry),
            // Down the axis the circles share.
            { backgroundColor: color, left },
          ]}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  connector: {
    // Re-centers the line on the circles' axis rather than hanging off the right.
    marginLeft: -CONNECTOR_WIDTH / 2,
    position: "absolute",
    width: CONNECTOR_WIDTH,
  },
});
