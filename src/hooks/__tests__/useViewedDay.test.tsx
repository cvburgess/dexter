import { Temporal } from "@js-temporal/polyfill";
import { render } from "@testing-library/react-native";

import { getViewedDay, usePublishViewedDay } from "@/hooks/useViewedDay";

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

const day = Temporal.PlainDate.from("2026-07-08");

function Publisher({ date }: { date: Temporal.PlainDate }) {
  usePublishViewedDay(date);
  return null;
}

describe("useViewedDay", () => {
  it("has no viewed day by default", () => {
    expect(getViewedDay()).toBeNull();
  });

  it("exposes the day a focused screen publishes", () => {
    render(<Publisher date={day} />);

    expect(getViewedDay()?.toString()).toBe("2026-07-08");
  });

  it("clears the viewed day when the publishing screen blurs", () => {
    const screen = render(<Publisher date={day} />);
    expect(getViewedDay()?.toString()).toBe("2026-07-08");

    screen.unmount();

    expect(getViewedDay()).toBeNull();
  });
});
