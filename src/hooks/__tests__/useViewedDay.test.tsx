import { Temporal } from "@js-temporal/polyfill";
import { render, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Text } from "react-native";

import {
  ViewedDayProvider,
  usePublishViewedDay,
  useViewedDay,
} from "@/hooks/useViewedDay";

// Stand in for react-navigation's focus lifecycle: run the effect on mount
// (focus) and its cleanup on unmount (blur). usePublishViewedDay memoizes the
// effect on [date], so a date change re-runs it just like a real re-focus.
jest.mock("expo-router", () => {
  const { useEffect } = require("react");
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      useEffect(() => effect(), [effect]);
    },
  };
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <ViewedDayProvider>{children}</ViewedDayProvider>
);

const day = Temporal.PlainDate.from("2026-07-08");

function Publisher({ date }: { date: Temporal.PlainDate }) {
  usePublishViewedDay(date);
  return null;
}

function Reader() {
  const viewedDay = useViewedDay();
  return (
    <Text testID="viewed">{viewedDay ? viewedDay.toString() : "none"}</Text>
  );
}

function Harness({ focused }: { focused: boolean }) {
  return (
    <ViewedDayProvider>
      {focused && <Publisher date={day} />}
      <Reader />
    </ViewedDayProvider>
  );
}

const readerText = (screen: ReturnType<typeof render>) =>
  screen.getByTestId("viewed").props.children;

describe("useViewedDay", () => {
  it("has no viewed day by default", () => {
    const { result } = renderHook(() => useViewedDay(), { wrapper });

    expect(result.current).toBeNull();
  });

  it("exposes the day a focused screen publishes", () => {
    const screen = render(<Harness focused />);

    expect(readerText(screen)).toBe("2026-07-08");
  });

  it("clears the viewed day when the publishing screen blurs", () => {
    const screen = render(<Harness focused />);
    expect(readerText(screen)).toBe("2026-07-08");

    screen.rerender(<Harness focused={false} />);

    expect(readerText(screen)).toBe("none");
  });
});
