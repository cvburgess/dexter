import { render } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";
import {
  fireGestureHandler,
  getByGestureTestId,
} from "react-native-gesture-handler/jest-utils";

import { SWIPEABLE_PAGE_MAX_WIDTH } from "@/utils/breakpoints";

import { getSwipeCommitDirection, SwipeablePage } from "../SwipeablePage";

const WIDTH = 400;

describe("getSwipeCommitDirection", () => {
  it("snaps back when the drag distance and velocity are both below threshold", () => {
    expect(getSwipeCommitDirection(20, 10, WIDTH)).toBe(0);
  });

  it("commits to the next page when dragged past the distance threshold", () => {
    expect(getSwipeCommitDirection(-150, 0, WIDTH)).toBe(1);
  });

  it("commits to the previous page when dragged past the distance threshold", () => {
    expect(getSwipeCommitDirection(150, 0, WIDTH)).toBe(-1);
  });

  it("commits on a fast flick even when the distance is short", () => {
    expect(getSwipeCommitDirection(-20, -900, WIDTH)).toBe(1);
    expect(getSwipeCommitDirection(20, 900, WIDTH)).toBe(-1);
  });

  it("uses velocity's sign, not translation's, when a flick nets near-zero or opposite displacement", () => {
    // Fast leftward flick that nets out with zero net displacement.
    expect(getSwipeCommitDirection(0, -900, WIDTH)).toBe(1);
    // Fast leftward flick despite a slight rightward net translation.
    expect(getSwipeCommitDirection(3, -900, WIDTH)).toBe(1);
    // Fast rightward flick despite a slight leftward net translation.
    expect(getSwipeCommitDirection(-3, 900, WIDTH)).toBe(-1);
  });
});

describe("SwipeablePage", () => {
  // DEX-138: `width: "100%"` is half the pair — without it the centering stage
  // would shrink the page to its content instead of capping it.
  it("caps and centers the page at a tablet-portrait width", () => {
    const screen = render(
      <SwipeablePage pageKey="horoscope" direction={0} onSwipe={jest.fn()}>
        <Text>Horoscope</Text>
      </SwipeablePage>,
    );

    expect(
      StyleSheet.flatten(screen.getByTestId("swipeable-page").props.style),
    ).toMatchObject({ maxWidth: SWIPEABLE_PAGE_MAX_WIDTH, width: "100%" });
  });

  it("commits forward when swiped left past the threshold", () => {
    const onSwipe = jest.fn();
    render(
      <SwipeablePage pageKey="2026-07-06" direction={0} onSwipe={onSwipe}>
        <Text>Task A</Text>
      </SwipeablePage>,
    );

    fireGestureHandler(getByGestureTestId("page-swipe"), [
      { translationX: -200, velocityX: -900 },
    ]);

    expect(onSwipe).toHaveBeenCalledWith(1);
  });

  it("commits backward when swiped right past the threshold", () => {
    const onSwipe = jest.fn();
    render(
      <SwipeablePage pageKey="2026-07-06" direction={0} onSwipe={onSwipe}>
        <Text>Task A</Text>
      </SwipeablePage>,
    );

    fireGestureHandler(getByGestureTestId("page-swipe"), [
      { translationX: 200, velocityX: 900 },
    ]);

    expect(onSwipe).toHaveBeenCalledWith(-1);
  });

  it("does not commit a sub-threshold pan", () => {
    const onSwipe = jest.fn();
    render(
      <SwipeablePage pageKey="2026-07-06" direction={0} onSwipe={onSwipe}>
        <Text>Task A</Text>
      </SwipeablePage>,
    );

    fireGestureHandler(getByGestureTestId("page-swipe"), [
      { translationX: 10, velocityX: 5 },
    ]);

    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("does not commit a past-threshold swipe when disabled", () => {
    const onSwipe = jest.fn();
    render(
      <SwipeablePage
        pageKey="2026-07-06"
        direction={0}
        enabled={false}
        onSwipe={onSwipe}
      >
        <Text>Task A</Text>
      </SwipeablePage>,
    );

    fireGestureHandler(getByGestureTestId("page-swipe"), [
      { translationX: -200, velocityX: -900 },
    ]);

    expect(onSwipe).not.toHaveBeenCalled();
  });

  // Declining inside the component is what un-strands the drag offset: only a
  // `pageKey` change resets it, and a host with nowhere to go keeps its key.
  it("does not commit forward past the last page", () => {
    const onSwipe = jest.fn();
    render(
      <SwipeablePage
        pageKey="congrats"
        canNext={false}
        direction={0}
        onSwipe={onSwipe}
      >
        <Text>Congrats</Text>
      </SwipeablePage>,
    );

    fireGestureHandler(getByGestureTestId("page-swipe"), [
      { translationX: -200, velocityX: -900 },
    ]);

    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("does not commit backward before the first page", () => {
    const onSwipe = jest.fn();
    render(
      <SwipeablePage
        pageKey="horoscope"
        canPrev={false}
        direction={0}
        onSwipe={onSwipe}
      >
        <Text>Horoscope</Text>
      </SwipeablePage>,
    );

    fireGestureHandler(getByGestureTestId("page-swipe"), [
      { translationX: 200, velocityX: 900 },
    ]);

    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("still commits the direction that is available at a boundary", () => {
    const onSwipe = jest.fn();
    render(
      <SwipeablePage
        pageKey="horoscope"
        canPrev={false}
        direction={0}
        onSwipe={onSwipe}
      >
        <Text>Horoscope</Text>
      </SwipeablePage>,
    );

    fireGestureHandler(getByGestureTestId("page-swipe"), [
      { translationX: -200, velocityX: -900 },
    ]);

    expect(onSwipe).toHaveBeenCalledWith(1);
  });
});
