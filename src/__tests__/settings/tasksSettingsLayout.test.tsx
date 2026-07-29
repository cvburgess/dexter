import { render } from "@testing-library/react-native";

import TasksSettingsLayout, {
  unstable_settings,
} from "@/app/(app)/(tabs)/settings/tasks/_layout";

// The real Stack/Stack.Screen require a navigation container this unit test
// doesn't mount; render children through a passthrough and echo the options
// that decide how each screen is presented.
jest.mock("expo-router", () => {
  const { Text } =
    jest.requireActual<typeof import("react-native")>("react-native");
  const Stack = ({ children }: { children?: React.ReactNode }) => children;
  Stack.Screen = function StackScreen({
    name,
    options,
  }: {
    name: string;
    options?: { headerShown?: boolean; presentation?: string };
  }) {
    const header = options?.headerShown === false ? "hidden" : "shown";
    return (
      <Text>{`screen:${name}|header:${header}|presentation:${options?.presentation ?? "card"}`}</Text>
    );
  };
  return { Stack };
});

describe("TasksSettingsLayout", () => {
  // The anchor is what mounts the list beneath the editor however the editor is
  // reached — including `MoreMenu` pushing `tasks/[id]` straight from a task
  // card, which has no settings history of its own.
  it("anchors the stack on its list", () => {
    expect(unstable_settings.anchor).toBe("index");
  });

  // The list's header belongs to the *parent* settings stack: this screen is
  // this stack's root, so a header declared here renders without a back button
  // and without swipe-back, whatever sits under the navigator (DEX-93).
  it("leaves the list's header to the parent settings stack", () => {
    const screen = render(<TasksSettingsLayout />);

    expect(
      screen.getByText("screen:index|header:hidden|presentation:card"),
    ).toBeTruthy();
  });

  it("presents the editor as a form sheet with its own header", () => {
    const screen = render(<TasksSettingsLayout />);

    expect(
      screen.getByText("screen:[id]|header:shown|presentation:formSheet"),
    ).toBeTruthy();
  });
});
