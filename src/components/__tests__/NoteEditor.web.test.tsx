import { render } from "@testing-library/react-native";
import { Text } from "react-native";

import { NoteEditor } from "../NoteEditor.web";

// The library resolves to its native entry under Jest; stub it so the web
// wrapper renders without the native codegen components.
const mockEnrichedMarkdownText = jest.fn(
  ({ markdown }: { markdown: string }) => <Text>{markdown}</Text>,
);
jest.mock("react-native-enriched-markdown", () => ({
  EnrichedMarkdownText: (props: { markdown: string }) =>
    mockEnrichedMarkdownText(props),
}));

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
