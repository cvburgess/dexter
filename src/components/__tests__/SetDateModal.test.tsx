import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";
import { Text, TouchableOpacity } from "react-native";

import { dateToPlainDateISO } from "@/utils/plainDate";

import type { TDateFieldProps } from "../DateField.types";
import { SetDateModal } from "../SetDateModal";

const PICKED_DATE = new Date(2026, 11, 25); // Dec 25, 2026 (month is 0-based)
const PICKED_ISO = "2026-12-25";

// `DateField` wraps a native SwiftUI/community picker with no test double, so
// stand it in with a pressable that surfaces the props the modal wires up (the
// same stub `DayNav.test.tsx` uses).
const mockDateField = jest.fn((props: TDateFieldProps) => (
  <TouchableOpacity
    accessibilityLabel="Pick a date"
    onPress={() => props.onChange(PICKED_DATE)}
  >
    <Text>{props.value.toISOString()}</Text>
  </TouchableOpacity>
));
jest.mock("../DateField", () => ({
  DateField: (props: Parameters<typeof mockDateField>[0]) =>
    mockDateField(props),
}));

/** The date the picker is currently showing, as `"YYYY-MM-DD"`. */
const seededDate = () => {
  const { calls } = mockDateField.mock;
  return dateToPlainDateISO(calls[calls.length - 1][0].value);
};

describe("SetDateModal", () => {
  beforeEach(() => jest.clearAllMocks());

  const renderModal = (props: Partial<Parameters<typeof SetDateModal>[0]>) => (
    <SetDateModal
      field="deadline"
      visible
      initialDate={null}
      onCancel={jest.fn()}
      onConfirm={jest.fn()}
      {...props}
    />
  );

  it("titles the sheet and its confirm button for the field being edited", () => {
    const deadline = render(renderModal({ field: "deadline" }));
    expect(deadline.getAllByText("Set deadline")).toHaveLength(2);

    const schedule = render(renderModal({ field: "schedule" }));
    expect(schedule.getAllByText("Set schedule")).toHaveLength(2);
  });

  it("seeds the picker from the task's current date", () => {
    render(renderModal({ initialDate: "2026-07-03" }));

    expect(seededDate()).toBe("2026-07-03");
  });

  it("seeds today when the field has no date yet", () => {
    render(renderModal({ initialDate: null }));

    expect(seededDate()).toBe(Temporal.Now.plainDateISO().toString());
  });

  it("confirms the picked date as an ISO string", () => {
    const onConfirm = jest.fn();
    const screen = render(renderModal({ onConfirm }));

    fireEvent.press(screen.getByLabelText("Pick a date"));
    fireEvent.press(screen.getAllByText("Set deadline")[1]);

    expect(onConfirm).toHaveBeenCalledWith(PICKED_ISO);
  });

  it("cancels without confirming", () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    const screen = render(renderModal({ onCancel, onConfirm }));

    fireEvent.press(screen.getByLabelText("Pick a date"));
    fireEvent.press(screen.getByText("Cancel"));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // The modal stays mounted while `visible` toggles, so an abandoned pick must
  // not still be showing the next time it opens.
  it("re-seeds from the current date each time it opens", () => {
    const screen = render(
      renderModal({ visible: false, initialDate: "2026-07-03" }),
    );

    screen.rerender(renderModal({ visible: true, initialDate: "2026-07-03" }));
    expect(seededDate()).toBe("2026-07-03");

    // Pick a different date, then dismiss without confirming.
    fireEvent.press(screen.getByLabelText("Pick a date"));
    expect(seededDate()).toBe(PICKED_ISO);
    screen.rerender(renderModal({ visible: false, initialDate: "2026-08-09" }));

    screen.rerender(renderModal({ visible: true, initialDate: "2026-08-09" }));
    expect(seededDate()).toBe("2026-08-09");
  });
});
