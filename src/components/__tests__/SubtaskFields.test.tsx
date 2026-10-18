import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";

import { SubtaskFields } from "../SubtaskFields";

type Row = { id: string; title: string };

// Controlled component, driven through a stateful host — asserting against
// a static `value` would only ever test the first change.
function Host({
  initial = [] as Row[],
  onAddRow,
}: {
  initial?: Row[];
  onAddRow?: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(initial);

  return (
    <SubtaskFields
      value={rows}
      onChange={setRows}
      makeRow={(id) => ({ id, title: "" })}
      onAddRow={onAddRow}
      testIDPrefix="test"
    />
  );
}

const addRow = () => fireEvent.press(screen.getByTestId("test-add-subtask"));
const draftInput = () => screen.getByPlaceholderText("Subtask");

describe("SubtaskFields", () => {
  it("renders no rows until one is added", async () => {
    await render(<Host />);

    expect(screen.queryByPlaceholderText("Subtask")).toBeNull();
  });

  it("adds an empty focused row", async () => {
    await render(<Host />);

    await addRow();

    expect(draftInput()).toBeTruthy();
  });

  it("keeps a titled row", async () => {
    await render(<Host />);

    await addRow();
    await fireEvent.changeText(draftInput(), "Pack bag");
    await fireEvent(draftInput(), "blur");

    expect(screen.getByText("Pack bag")).toBeTruthy();
  });

  it("discards a row left empty, rather than reverting it", async () => {
    // Nothing here has been saved yet, so there is no stored title to revert
    // to — the opposite of the in-card rule in TaskCard.
    await render(<Host initial={[{ id: "s1", title: "Existing" }]} />);

    await addRow();
    await fireEvent(draftInput(), "blur");

    expect(screen.queryByPlaceholderText("Subtask")).toBeNull();
    expect(screen.getByText("Existing")).toBeTruthy();
  });

  it("reverts an existing row whose title is emptied, rather than deleting it", async () => {
    // The template form seeds this from saved rows, so clearing the text to
    // retype must not silently drop a checklist item from the blueprint.
    await render(<Host initial={[{ id: "s1", title: "Existing" }]} />);

    await fireEvent.press(screen.getByTestId("test-subtask-s1"));
    await fireEvent.changeText(screen.getByTestId("test-subtask-s1-input"), "");
    await fireEvent(screen.getByTestId("test-subtask-s1-input"), "blur");

    expect(screen.getByText("Existing")).toBeTruthy();
  });

  it("removes a row through its explicit ✕", async () => {
    await render(<Host initial={[{ id: "s1", title: "Existing" }]} />);

    await fireEvent.press(screen.getByTestId("test-remove-subtask-s1"));

    expect(screen.queryByText("Existing")).toBeNull();
  });

  it("mirrors keystrokes into form state before any commit", async () => {
    // On native, tapping Save does not blur the focused input first, so a row
    // that is only committed on blur would be dropped from the payload.
    const onChange = jest.fn();
    await render(
      <SubtaskFields
        value={[{ id: "s1", title: "" }]}
        onChange={onChange}
        makeRow={(id) => ({ id, title: "" })}
        testIDPrefix="test"
      />,
    );

    await fireEvent.press(screen.getByTestId("test-subtask-s1"));
    await fireEvent.changeText(
      screen.getByTestId("test-subtask-s1-input"),
      "Pack",
    );

    expect(onChange).toHaveBeenCalledWith([{ id: "s1", title: "Pack" }]);
  });

  it("chains another row when return commits a non-empty title", async () => {
    await render(<Host />);

    await addRow();
    await fireEvent.changeText(draftInput(), "Pack bag");
    await fireEvent(draftInput(), "submitEditing");

    // The committed row is now static text and a fresh empty row is focused.
    expect(screen.getByText("Pack bag")).toBeTruthy();
    expect(draftInput()).toBeTruthy();
  });

  // A new row autofocuses, so a form whose checklist runs past the keyboard has
  // to scroll it into view — both ways of adding one must announce it.
  it("announces every added row, from the button and from the chain", async () => {
    const onAddRow = jest.fn();
    await render(<Host onAddRow={onAddRow} />);

    await addRow();
    expect(onAddRow).toHaveBeenCalledTimes(1);

    await fireEvent.changeText(draftInput(), "Pack bag");
    await fireEvent(draftInput(), "submitEditing");

    expect(onAddRow).toHaveBeenCalledTimes(2);
  });

  it("ends the chain when return commits an empty row", async () => {
    await render(<Host />);

    await addRow();
    await fireEvent(draftInput(), "submitEditing");

    expect(screen.queryByPlaceholderText("Subtask")).toBeNull();
  });

  it("passes the caller's extra fields through on a new row", async () => {
    // The template form's rows carry no status; a task's do. `makeRow` is what
    // keeps one component serving both.
    const onChange = jest.fn();
    await render(
      <SubtaskFields
        value={[]}
        onChange={onChange}
        makeRow={(id) => ({ id, title: "", status: 1 })}
        testIDPrefix="test"
      />,
    );

    await addRow();

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ title: "", status: 1 }),
    ]);
  });
});
