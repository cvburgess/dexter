import { act } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { createRoot, type Root, type TestInstance } from "test-renderer";

import { DateField } from "../DateField.web";

const SELECTED_DATE = new Date(2026, 11, 25); // Dec 25, 2026 (month is 0-based)

// WebOverlay portals to document.body at runtime; render inline here so
// the test renderer keeps it in the tree.
jest.mock("react-dom", () =>
  require("@/testUtils/mockReactDomPortal").mockReactDomPortal(),
);

// react-day-picker has no test double; stand it in with a day button firing
// onSelect. Its stylesheet import is stubbed so Jest doesn't parse CSS.
const mockDayPicker = jest.fn((props: { onSelect: (date: Date) => void }) => (
  <button data-testid="rdp-day" onClick={() => props.onSelect(SELECTED_DATE)}>
    25
  </button>
));
jest.mock("react-day-picker/style.css", () => ({}));
jest.mock("react-day-picker", () => ({
  DayPicker: (props: Parameters<typeof mockDayPicker>[0]) =>
    mockDayPicker(props),
}));

// RNTL's `render` rejects text inside a DOM `<button>`, exactly where this
// trigger's label lives, and its `fireEvent` only reaches that tree; a bare root admits it.
const roots: Root[] = [];
const render = async (element: ReactElement) => {
  const root = createRoot();
  roots.push(root);
  await act(() => root.render(element));
  return root.container;
};
afterEach(async () => {
  for (const root of roots.splice(0)) await act(() => root.unmount());
});

const queryAllByDataTestId = (container: TestInstance, id: string) =>
  container.queryAll((node) => node.props["data-testid"] === id);

const getTrigger = (container: TestInstance) =>
  queryAllByDataTestId(container, "field")[0];

const click = (node: TestInstance) => act(() => node.props.onClick());

// The trigger's ref resolves to this very test instance, which has no layout.
const clickTrigger = (container: TestInstance) => {
  const trigger = getTrigger(container);
  Object.assign(trigger, {
    getBoundingClientRect: () => ({ bottom: 0, left: 0, width: 0 }),
  });
  return click(trigger);
};

/** `WebOverlay`'s portal root — the only node re-declaring pointer events. */
const overlayRoots = (container: TestInstance) =>
  container.queryAll(
    (node) => node.type === "div" && node.props.style?.pointerEvents === "auto",
  );

describe("DateField (web)", () => {
  it("renders the value as a Weekday, Mon D label", async () => {
    const container = await render(
      <DateField
        testID="field"
        value={new Date(2026, 6, 3)}
        onChange={jest.fn()}
      />,
    );

    expect(getTrigger(container).props.children).toBe("Friday, Jul 3");
  });

  it("does not open the calendar until the trigger is pressed", async () => {
    const container = await render(
      <DateField
        testID="field"
        value={new Date(2026, 6, 3)}
        onChange={jest.fn()}
      />,
    );

    expect(queryAllByDataTestId(container, "rdp-day")).toHaveLength(0);

    await clickTrigger(container);

    expect(queryAllByDataTestId(container, "rdp-day")).toHaveLength(1);
  });

  // Not decoration: a raw createPortal inherits Radix's body-wide
  // pointer-events: none (DEX-134); only WebOverlay re-declares auto.
  it("renders the calendar through WebOverlay", async () => {
    const container = await render(
      <DateField
        testID="field"
        value={new Date(2026, 6, 3)}
        onChange={jest.fn()}
      />,
    );

    expect(overlayRoots(container)).toHaveLength(0);

    await clickTrigger(container);

    expect(overlayRoots(container)).toHaveLength(1);
  });

  it("calls onChange with the picked Date and closes the calendar", async () => {
    const onChange = jest.fn<void, [Date]>();
    const container = await render(
      <DateField
        testID="field"
        value={new Date(2026, 6, 3)}
        onChange={onChange}
      />,
    );

    await clickTrigger(container);
    await click(queryAllByDataTestId(container, "rdp-day")[0]);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(SELECTED_DATE);
    expect(queryAllByDataTestId(container, "rdp-day")).toHaveLength(0);
  });
});
