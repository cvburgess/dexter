import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";

import { SubtaskFields } from "../SubtaskFields";

type Row = { id: string; title: string };

/**
 * The component is controlled, so drive it through a stateful host — asserting
 * against a static `value` would only ever test the first change.
 */
function Host({ initial = [] as Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);

  return (
    <SubtaskFields
      value={rows}
      onChange={setRows}
      makeRow={(id) => ({ id, title: "" })}
      testIDPrefix="test"
    />
  );
}

const addRow = () => fireEvent.press(screen.getByTestId("test-add-subtask"));
const draftInput = () => screen.getByPlaceholderText("Subtask");

describe("SubtaskFields", () => {
  it("renders no rows until one is added", () => {
    render(<Host />);

    expect(screen.queryByPlaceholderText("Subtask")).toBeNull();
  });

  it("adds an empty focused row", () => {
    render(<Host />);

    addRow();

    expect(draftInput()).toBeTruthy();
  });

  it("keeps a titled row", () => {
    render(<Host />);

    addRow();
    fireEvent.changeText(draftInput(), "Pack bag");
    fireEvent(draftInput(), "blur");

    expect(screen.getByText("Pack bag")).toBeTruthy();
  });

  it("discards a row left empty, rather than reverting it", () => {
    // Nothing here has been saved yet, so there is no stored title to revert
    // to — the opposite of the in-card rule in TaskCard.
    render(<Host initial={[{ id: "s1", title: "Existing" }]} />);

    addRow();
    fireEvent(draftInput(), "blur");

    expect(screen.queryByPlaceholderText("Subtask")).toBeNull();
    expect(screen.getByText("Existing")).toBeTruthy();
  });

  it("reverts an existing row whose title is emptied, rather than deleting it", () => {
    // The template form seeds this from saved rows, so clearing the text to
    // retype must not silently drop a checklist item from the blueprint.
    render(<Host initial={[{ id: "s1", title: "Existing" }]} />);

    fireEvent.press(screen.getByTestId("test-subtask-s1"));
    fireEvent.changeText(screen.getByTestId("test-subtask-s1-input"), "");
    fireEvent(screen.getByTestId("test-subtask-s1-input"), "blur");

    expect(screen.getByText("Existing")).toBeTruthy();
  });

  it("removes a row through its explicit ✕", () => {
    render(<Host initial={[{ id: "s1", title: "Existing" }]} />);

    fireEvent.press(screen.getByTestId("test-remove-subtask-s1"));

    expect(screen.queryByText("Existing")).toBeNull();
  });

  it("mirrors keystrokes into form state before any commit", () => {
    // On native, tapping Save does not blur the focused input first, so a row
    // that is only committed on blur would be dropped from the payload.
    const onChange = jest.fn();
    render(
      <SubtaskFields
        value={[{ id: "s1", title: "" }]}
        onChange={onChange}
        makeRow={(id) => ({ id, title: "" })}
        testIDPrefix="test"
      />,
    );

    fireEvent.press(screen.getByTestId("test-subtask-s1"));
    fireEvent.changeText(screen.getByTestId("test-subtask-s1-input"), "Pack");

    expect(onChange).toHaveBeenCalledWith([{ id: "s1", title: "Pack" }]);
  });

  it("chains another row when return commits a non-empty title", () => {
    render(<Host />);

    addRow();
    fireEvent.changeText(draftInput(), "Pack bag");
    fireEvent(draftInput(), "submitEditing");

    // The committed row is now static text and a fresh empty row is focused.
    expect(screen.getByText("Pack bag")).toBeTruthy();
    expect(draftInput()).toBeTruthy();
  });

  it("ends the chain when return commits an empty row", () => {
    render(<Host />);

    addRow();
    fireEvent(draftInput(), "submitEditing");

    expect(screen.queryByPlaceholderText("Subtask")).toBeNull();
  });

  it("passes the caller's extra fields through on a new row", () => {
    // The template form's rows carry no status; a task's do. `makeRow` is what
    // keeps one component serving both.
    const onChange = jest.fn();
    render(
      <SubtaskFields
        value={[]}
        onChange={onChange}
        makeRow={(id) => ({ id, title: "", status: 1 })}
        testIDPrefix="test"
      />,
    );

    addRow();

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ title: "", status: 1 }),
    ]);
  });
});
