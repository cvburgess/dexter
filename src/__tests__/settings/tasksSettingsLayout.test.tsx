import { render } from "@testing-library/react-native";

import TasksSettingsLayout, {
  unstable_settings,
} from "@/app/(app)/(tabs)/settings/tasks/_layout";

// The real Stack needs a navigation container this test doesn't mount; render
// children through a passthrough and echo how each screen is presented.
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
  // Mounts the list beneath the editor however it's reached, including
  // `MoreMenu` pushing `tasks/[id]` with no settings history of its own.
  it("anchors the stack on its list", () => {
    expect(unstable_settings.anchor).toBe("index");
  });

  // This screen is this stack's root, so a header declared here would render
  // with no back button and no swipe-back regardless of what's underneath (DEX-93).
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
