import { Temporal } from "@js-temporal/polyfill";
import type { ReactNode } from "react";
import { Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { renderWithBottomInset } from "@/testUtils/renderWithBottomInset";

import { TaskDrawerSheet } from "../TaskDrawerSheet";

// @expo/ui's bottom sheet is a native host with no test double. Render its
// children inline and fire the `onChange` that marks the sheet opened, which is
// what gates TaskDrawer's deferred mount.
jest.mock("@expo/ui/community/bottom-sheet", () => {
  const { useEffect } = jest.requireActual<typeof import("react")>("react");
  return {
    BottomSheetModal: function MockBottomSheetModal({
      children,
      onChange,
    }: {
      children: ReactNode;
      onChange?: (index: number) => void;
    }) {
      useEffect(() => onChange?.(0), [onChange]);
      return children;
    },
    BottomSheetView: function MockBottomSheetView({
      children,
    }: {
      children: ReactNode;
    }) {
      return children;
    },
  };
});

// Stand in for the drawer with a probe that reports the inset its host
// publishes — the one thing this shell owes its content.
function MockTaskDrawer() {
  const insets = useSafeAreaInsets();
  return <Text>{`bottom:${insets.bottom} top:${insets.top}`}</Text>;
}
jest.mock("../TaskDrawer", () => ({
  TaskDrawer: () => <MockTaskDrawer />,
}));

describe("TaskDrawerSheet", () => {
  const date = Temporal.PlainDate.from("2026-07-16");

  // The Today screens publish a bottom inset with the native tab bar's height
  // baked in, but this sheet is presented over that bar — so for its content
  // the figure is wrong, and the shell corrects it rather than making each
  // child compensate for a host it can't see (DEX-91).
  it("zeroes the bottom inset for its content", () => {
    const screen = renderWithBottomInset(83, <TaskDrawerSheet date={date} />);

    expect(screen.getByText("bottom:0 top:0")).toBeTruthy();
  });
});
