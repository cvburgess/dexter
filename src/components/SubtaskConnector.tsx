import { StyleSheet, View } from "react-native";

import { SUBTASK_ROW_HEIGHT, SUBTASK_STATUS_SIZE } from "./SubtaskRow";

// Checklist spacing. Constants rather than literals in the stylesheets because
// the connector rail is positioned from the same numbers — if the two drift,
// the line stops meeting the circles.
export const SUBTASK_GAP = 2;
/** Between the row the checklist hangs from and the first subtask. Padding, not
 * margin, so the rail's first segment starts inside the box it's positioned
 * against. */
export const SUBTASK_OFFSET = 8;
/** Half the difference between a parent card's 32px buttons and a subtask's
 * 24px ones — the inset that puts both columns of circles on the same axes. */
export const SUBTASK_INSET = 4;
/** Matches StatusButton's `borderWidth`, so the rail reads as the same stroke
 * as the circles it joins (its color matches their border opacity too). */
const CONNECTOR_WIDTH = 1;

/**
 * The rail segment linking one subtask's circle up to the circle above it (the
 * parent's, for the first row). Deliberately segments and not one continuous
 * line: the circles are transparent, so a full-length rail would be visible
 * straight through the middle of every one of them.
 */
const connectorSegment = (index: number, offset: number) => {
  const circleInset = (SUBTASK_ROW_HEIGHT - SUBTASK_STATUS_SIZE) / 2;
  const top = offset + index * (SUBTASK_ROW_HEIGHT + SUBTASK_GAP) + circleInset;
  // The parent's circle fills its row, so its underside is the checklist's top
  // edge; a sibling's clears the gap and its own inset first.
  const previousBottom = index === 0 ? 0 : top - SUBTASK_GAP - circleInset * 2;
  return { height: top - previousBottom, top: previousBottom };
};

type TSubtaskConnectorsProps = {
  count: number;
  color: string;
  /**
   * Distance from the container's top edge to the first row. Defaults to the
   * card's padding; the create form passes more, because its checklist also has
   * the form's row gap to climb before it reaches the row it hangs from.
   */
  offset?: number;
  /**
   * The rows' left inset. Absolutely positioned children are laid out from the
   * padding edge, so a container that insets its rows has to say so here or the
   * rail lands to the left of the circles. Defaults to the card's inset.
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
 * rows out on the same geometry —
 * `SUBTASK_GAP` between rows, each `SUBTASK_ROW_HEIGHT` tall, leading circles
 * `SUBTASK_STATUS_SIZE` wide.
 */
export function SubtaskConnectors({
  count,
  color,
  offset = SUBTASK_OFFSET,
  inset = SUBTASK_INSET,
  leading = true,
}: TSubtaskConnectorsProps) {
  // Each segment is named by the row it arrives at, so dropping the leading one
  // is dropping row 0's.
  const segments = Array.from({ length: count }, (_, index) => index).slice(
    leading ? 0 : 1,
  );

  return (
    <>
      {segments.map((index) => (
        <View
          key={`connector-${index}`}
          style={[
            styles.connector,
            connectorSegment(index, offset),
            // Down the axis the circles share.
            { backgroundColor: color, left: inset + SUBTASK_STATUS_SIZE / 2 },
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
