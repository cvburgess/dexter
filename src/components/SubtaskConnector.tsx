import { StyleSheet, View } from "react-native";

import { Theme, useTheme } from "@/utils/theme";

/**
 * Every number the checklist is laid out from, derived from the theme in one
 * place because the connector rail is positioned from the same set — if a row's
 * geometry and the rail's drift apart, the line stops meeting the circles. The
 * rows are also what a card's own padding is measured against, so `TaskCard`
 * reads from here too.
 */
export type TSubtaskGeometry = {
  /** Diameter of a subtask's status circle. */
  statusSize: number;
  /** Height of one row. Titles are single-line, so every row is exactly this tall. */
  rowHeight: number;
  /** Between rows. */
  gap: number;
  /**
   * Between the row the checklist hangs from and the first subtask. Padding, not
   * margin, so the rail's first segment starts inside the box it's positioned
   * against.
   */
  offset: number;
  /** The rows' left inset — what puts both columns of circles on the same axis. */
  inset: number;
};

/**
 * A row is as tall as the parent's inline control and its circle is three
 * quarters of one, so the nesting reads at a glance on either density tier
 * (DEX-61 — these were fixed 32/24 px before).
 */
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

/**
 * The rail segment linking one subtask's circle up to the circle above it (the
 * parent's, for the first row). Deliberately segments and not one continuous
 * line: the circles are transparent, so a full-length rail would be visible
 * straight through the middle of every one of them.
 */
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
  /**
   * Distance from the container's top edge to the first row. Defaults to
   * `geometry.offset`; the create form passes more, because its checklist also
   * has the form's row gap to climb before it reaches the row it hangs from.
   */
  offset?: number;
  /**
   * The rows' left inset. Absolutely positioned children are laid out from the
   * padding edge, so a container that insets its rows has to say so here or the
   * rail lands to the left of the circles. Defaults to `geometry.inset`.
   */
  inset?: number;
  /**
   * Whether to draw the segment above the first row. True on a card, where it
   * links the checklist to the parent task's circle. False in a form, where the
   * row above is a section heading, not a task — a rail up to it would claim a
   * parentage that isn't there.
   */
  leading?: boolean;
};

/**
 * The rail running down a checklist (and, on a card, up to the parent it hangs
 * from), drawn as absolutely positioned segments over its container. The
 * container supplies the position context (any non-static box) and must lay its
 * rows out on `subtaskGeometry`: `gap` between rows, each `rowHeight` tall,
 * leading circles `statusSize` wide.
 */
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
    // The negative margin re-centers the line on the circles' axis rather than
    // hanging it off the right of it.
    marginLeft: -CONNECTOR_WIDTH / 2,
    position: "absolute",
    width: CONNECTOR_WIDTH,
  },
});
