import { Temporal } from "@js-temporal/polyfill";
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import TaskDrawerScreen from "@/app/(app)/task-drawer";

const mockParams = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams(),
}));

// TaskDrawer owns the drawer's data/UX (covered by TaskDrawer.test); stub it to
// a marker exposing the date it was handed so this suite asserts only the
// route's param parsing.
const mockTaskDrawer = ({ date }: { date: Temporal.PlainDate }) => (
  <Text>task-drawer:{date.toString()}</Text>
);
jest.mock("@/components/TaskDrawer", () => ({
  TaskDrawer: (props: Parameters<typeof mockTaskDrawer>[0]) =>
    mockTaskDrawer(props),
}));

describe("TaskDrawerScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders the drawer for the date param", () => {
    mockParams.mockReturnValue({ date: "2026-03-04" });
    render(<TaskDrawerScreen />);

    expect(screen.getByText("task-drawer:2026-03-04")).toBeTruthy();
  });

  it("defaults to today when no date param is present", () => {
    mockParams.mockReturnValue({});
    render(<TaskDrawerScreen />);

    expect(
      screen.getByText(`task-drawer:${Temporal.Now.plainDateISO().toString()}`),
    ).toBeTruthy();
  });
});
