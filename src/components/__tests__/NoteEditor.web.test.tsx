import { render } from "@testing-library/react-native";

import { NoteEditor } from "../NoteEditor.web";

describe("NoteEditor (web)", () => {
  it("renders the note markdown read-only", () => {
    const screen = render(
      <NoteEditor initialValue="# Today" onChangeMarkdown={jest.fn()} />,
    );

    expect(screen.getByText("# Today")).toBeTruthy();
  });

  it("never reports edits (read-only until upstream web input support)", () => {
    const onChangeMarkdown = jest.fn();
    render(
      <NoteEditor initialValue="notes" onChangeMarkdown={onChangeMarkdown} />,
    );

    expect(onChangeMarkdown).not.toHaveBeenCalled();
  });
});
