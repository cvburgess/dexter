import { render } from "@testing-library/react-native";

import { HabitRing } from "@/components/HabitRing";

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

  it("clamps out-of-range progress without throwing", () => {
    const screen = render(
      <HabitRing emoji="🏃" percentComplete={150} accessibilityLabel="Run" />,
    );

    expect(screen.getByText("🏃")).toBeTruthy();
  });
});
