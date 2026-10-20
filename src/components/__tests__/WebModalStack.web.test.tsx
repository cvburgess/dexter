import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";

import { isModalRoute, WebModalOverlay } from "../WebModalStack.web";

// The navigator factory pulls expo-router's whole module graph, which jest's
// ESM loader can't run; only `WebModalOverlay` and `isModalRoute` are under
// test here (the route-splitting is a thin port of the guide's tested code).
jest.mock("expo-router", () => ({
  NativeStackView: jest.fn(() => null),
  StackRouter: {},
  createStandardRouterNavigator: (Content: React.ComponentType<object>) =>
    Content,
}));

jest.mock("react-dom", () =>
  require("@/testUtils/mockReactDomPortal").mockReactDomPortal(),
);

// The overlay's effect binds Esc on `window`, which the jest env shims without
// `addEventListener` — capture the handler so tests can fire it directly.
type TKeyHandler = (event: Partial<KeyboardEvent>) => void;
const keyHandlers: Record<string, TKeyHandler> = {};
let windowAddEventListener: jest.Mock;

beforeEach(() => {
  keyHandlers.keydown = jest.fn((_event: Partial<KeyboardEvent>) => {});
  windowAddEventListener = jest.fn(
    (type: string, handler: TKeyHandler) => (keyHandlers[type] = handler),
  );
  window.addEventListener = windowAddEventListener as never;
  window.removeEventListener = jest.fn() as never;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("isModalRoute", () => {
  // The web navigator's whole strategy: `formSheet`/`modal` presentations (what
  // `createModalScreenOptions` emits) and the guide's own `modal` flag render
  // as dialogs; everything else stays a stack screen.
  it.each(["formSheet", "modal"] as const)(
    "treats the %s presentation as a dialog",
    (presentation) => {
      expect(isModalRoute({ presentation })).toBe(true);
    },
  );

  it("treats the guide's modal flag as a dialog", () => {
    expect(isModalRoute({ modal: true })).toBe(true);
  });

  it.each(["card", undefined] as const)(
    "leaves plain routes (%s) on the stack",
    (presentation) => {
      expect(isModalRoute({ presentation })).toBe(false);
    },
  );
});

describe("WebModalOverlay", () => {
  it("renders its children inside the dialog", async () => {
    const screen = await render(
      <WebModalOverlay onDismiss={jest.fn()}>
        <Text>Inside</Text>
      </WebModalOverlay>,
    );

    expect(screen.getByText("Inside")).toBeTruthy();
  });

  // Backdrop belongs to the overlay, not the dialog: pressing outside the
  // dialog must pop the modal route (matches the old stack's dismiss).
  it("dismisses on a backdrop press", async () => {
    const onDismiss = jest.fn();
    const screen = await render(
      <WebModalOverlay onDismiss={onDismiss}>
        <Text>Inside</Text>
      </WebModalOverlay>,
    );

    await fireEvent.press(screen.getByLabelText("Dismiss modal"));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses on Esc via the window listener", async () => {
    const onDismiss = jest.fn();
    await render(
      <WebModalOverlay onDismiss={onDismiss}>
        <Text>Inside</Text>
      </WebModalOverlay>,
    );

    keyHandlers.keydown({ key: "Escape" });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("ignores non-Escape keys", async () => {
    const onDismiss = jest.fn();
    await render(
      <WebModalOverlay onDismiss={onDismiss}>
        <Text>Inside</Text>
      </WebModalOverlay>,
    );

    keyHandlers.keydown({ key: "Enter" });

    expect(onDismiss).not.toHaveBeenCalled();
  });

  // Stacked modals each render an overlay; only the focused (top) one may own
  // the window listener, or one Esc press would close the whole pile.
  it("leaves Esc to the topmost dialog only", async () => {
    const lower = jest.fn();
    const top = jest.fn();
    await render(
      <>
        <WebModalOverlay onDismiss={lower} topmost={false}>
          <Text>Lower</Text>
        </WebModalOverlay>
        <WebModalOverlay onDismiss={top} topmost>
          <Text>Top</Text>
        </WebModalOverlay>
      </>,
    );

    keyHandlers.keydown({ key: "Escape" });

    expect(top).toHaveBeenCalledTimes(1);
    expect(lower).not.toHaveBeenCalled();
  });

  // The old `.modalBody` was flex with no direction (defaults to row); the
  // dialog is a bounded flex column so `ModalScreen`'s `flex: 1` fills it
  // (docs/frontend.md).
  it("shapes the dialog as a bounded flex column", async () => {
    const screen = await render(
      <WebModalOverlay onDismiss={jest.fn()}>
        <Text>Inside</Text>
      </WebModalOverlay>,
    );

    const dialog = screen.container.queryAll(
      (node) => node.props.role === "dialog",
    )[0];
    const style = StyleSheet.flatten(dialog.props.style);
    expect(style.flex).toBe(1);
    expect(style.flexDirection).toBe("column");
    expect(style.maxWidth).toBe(680);
  });
});
