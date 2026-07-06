import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import {
  fireGestureHandler,
  getByGestureTestId,
} from "react-native-gesture-handler/jest-utils";

import { getSwipeCommitDirection, SwipeableDay } from "../SwipeableDay";

const WIDTH = 400;

describe("getSwipeCommitDirection", () => {
  it("snaps back when the drag distance and velocity are both below threshold", () => {
    expect(getSwipeCommitDirection(20, 10, WIDTH)).toBe(0);
  });

  it("commits to the next day when dragged past the distance threshold", () => {
    expect(getSwipeCommitDirection(-150, 0, WIDTH)).toBe(1);
  });

  it("commits to the previous day when dragged past the distance threshold", () => {
    expect(getSwipeCommitDirection(150, 0, WIDTH)).toBe(-1);
  });

  it("commits on a fast flick even when the distance is short", () => {
    expect(getSwipeCommitDirection(-20, -900, WIDTH)).toBe(1);
    expect(getSwipeCommitDirection(20, 900, WIDTH)).toBe(-1);
  });
});

describe("SwipeableDay", () => {
  it("renders its children", () => {
    const screen = render(
      <SwipeableDay dateKey="2026-07-06" direction={0} onSwipe={jest.fn()}>
        <Text>Task A</Text>
      </SwipeableDay>,
    );

    expect(screen.getByText("Task A")).toBeTruthy();
  });

  it("commits forward when swiped left past the threshold", () => {
    const onSwipe = jest.fn();
    render(
      <SwipeableDay dateKey="2026-07-06" direction={0} onSwipe={onSwipe}>
        <Text>Task A</Text>
      </SwipeableDay>,
    );

    fireGestureHandler(getByGestureTestId("day-swipe"), [
      { translationX: -200, velocityX: -900 },
    ]);

    expect(onSwipe).toHaveBeenCalledWith(1);
  });

  it("commits backward when swiped right past the threshold", () => {
    const onSwipe = jest.fn();
    render(
      <SwipeableDay dateKey="2026-07-06" direction={0} onSwipe={onSwipe}>
        <Text>Task A</Text>
      </SwipeableDay>,
    );

    fireGestureHandler(getByGestureTestId("day-swipe"), [
      { translationX: 200, velocityX: 900 },
    ]);

    expect(onSwipe).toHaveBeenCalledWith(-1);
  });

  it("does not commit a sub-threshold pan", () => {
    const onSwipe = jest.fn();
    render(
      <SwipeableDay dateKey="2026-07-06" direction={0} onSwipe={onSwipe}>
        <Text>Task A</Text>
      </SwipeableDay>,
    );

    fireGestureHandler(getByGestureTestId("day-swipe"), [
      { translationX: 10, velocityX: 5 },
    ]);

    expect(onSwipe).not.toHaveBeenCalled();
  });
});
