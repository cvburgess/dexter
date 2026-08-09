import { render } from "@testing-library/react-native";
import { Text } from "react-native";

import { WebOverlay } from "../WebOverlay.web";

jest.mock("react-dom", () =>
  require("@/testUtils/mockReactDomPortal").mockReactDomPortal(),
);

/** The portal root — the only `div` the component renders itself. */
const overlayRoot = (screen: ReturnType<typeof render>) =>
  screen.UNSAFE_root.findAll(
    (node) => node.type === "div" && node.props.style?.position === "fixed",
  )[0];

describe("WebOverlay", () => {
  it("renders its children", () => {
    const screen = render(
      <WebOverlay>
        <Text>Inside</Text>
      </WebOverlay>,
    );

    expect(screen.getByText("Inside")).toBeTruthy();
  });

  // The bug this component exists for: a Radix dismissable layer sets
  // `pointer-events: none` on the body while a dialog or drawer is open, and
  // `pointer-events` is inherited, so a body portal is visible but dead unless
  // it re-declares `auto` on its own root.
  it("declares pointer events on its root so the body's `none` can't reach it", () => {
    const screen = render(
      <WebOverlay>
        <Text>Inside</Text>
      </WebOverlay>,
    );

    expect(overlayRoot(screen).props.style.pointerEvents).toBe("auto");
  });

  // The root covers the viewport so children can anchor to `getBoundingClientRect()`
  // coordinates without any containing-block offset math.
  it("covers the viewport above the modal chrome", () => {
    const screen = render(
      <WebOverlay>
        <Text>Inside</Text>
      </WebOverlay>,
    );

    const { position, inset, zIndex } = overlayRoot(screen).props.style;
    expect({ position, inset }).toEqual({ position: "fixed", inset: 0 });
    // Above expo-router's `.modal`, which takes `z-index: 50`.
    expect(zIndex).toBeGreaterThan(50);
  });

  // Radix reads a `pointerdown` outside its layer as an outside click and
  // dismisses. The portal root is a body child, so it is outside by
  // construction — without this, re-enabling pointer events would mean a click
  // inside the overlay closed the modal screen behind it.
  it.each(["onPointerDown", "onMouseDown"] as const)(
    "stops %s from reaching the dismissable layer on the document",
    (handler) => {
      const screen = render(
        <WebOverlay>
          <Text>Inside</Text>
        </WebOverlay>,
      );
      const stopPropagation = jest.fn();

      overlayRoot(screen).props[handler]({ stopPropagation });

      expect(stopPropagation).toHaveBeenCalled();
    },
  );
});
