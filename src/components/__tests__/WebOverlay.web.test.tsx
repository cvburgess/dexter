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

  // Radix sets `pointer-events: none` on the body while open, and it's
  // inherited — a body portal is visible but dead unless it re-declares `auto`.
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

  // Radix reads an outside `pointerdown` as a dismiss; the portal root is a
  // body child, so without this a click inside the overlay closes it.
  it("stops pointerdown from reaching the dismissable layer on the document", () => {
    const screen = render(
      <WebOverlay>
        <Text>Inside</Text>
      </WebOverlay>,
    );
    const stopPropagation = jest.fn();

    overlayRoot(screen).props.onPointerDown({ stopPropagation });

    expect(stopPropagation).toHaveBeenCalled();
  });

  // react-native-web binds these on the document for every Pressable, so
  // stopping them kills touch for nothing — Radix already read a pointerdown.
  it.each(["onMouseDown", "onTouchStart"] as const)(
    "leaves %s alone, so react-native-web pressables still respond",
    (handler) => {
      const screen = render(
        <WebOverlay>
          <Text>Inside</Text>
        </WebOverlay>,
      );

      expect(overlayRoot(screen).props[handler]).toBeUndefined();
    },
  );
});
