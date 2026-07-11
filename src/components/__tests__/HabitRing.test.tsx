import { render } from "@testing-library/react-native";

import { HabitRing } from "@/components/HabitRing";

// The ring's arc animates via Animated.timing, which schedules timers. Fake
// timers keep those from firing after the test environment tears down.
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// useTheme reads from a provider in the app, but the hook falls back to a
// default theme when unwrapped, so the ring renders standalone here.

describe("HabitRing", () => {
  it("renders the emoji for a partially complete habit", () => {
    const screen = render(
      <HabitRing emoji="📖" percentComplete={50} accessibilityLabel="Read" />,
    );

    expect(screen.getByText("📖")).toBeTruthy();
  });

  it("renders a faded, inert ring without throwing", () => {
    const screen = render(
      <HabitRing
        emoji="💧"
        percentComplete={0}
        faded
        accessibilityLabel="Water"
      />,
    );

    expect(screen.getByText("💧")).toBeTruthy();
  });

  it("swaps the emoji for a checkmark once complete (clamping past 100)", () => {
    const screen = render(
      <HabitRing emoji="🏃" percentComplete={150} accessibilityLabel="Run" />,
    );

    // At 100%+ the ring fills and the glyph becomes a checkmark, so the emoji
    // is no longer rendered.
    expect(screen.queryByText("🏃")).toBeNull();
  });
});
