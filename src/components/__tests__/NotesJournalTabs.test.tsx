import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

import { NotesJournalTabs } from "../NotesJournalTabs";

// NotesView/JournalView read via hooks that need a QueryClientProvider or
// native modules this unit test doesn't mount; their own behavior is covered
// by their own tests. Stub each to a marker.
const mockNotesView = () => <Text>notes-view</Text>;
jest.mock("../NotesView", () => ({ NotesView: () => mockNotesView() }));
const mockJournalView = () => <Text>journal-view</Text>;
jest.mock("../JournalView", () => ({ JournalView: () => mockJournalView() }));

describe("NotesJournalTabs", () => {
  it("shows Notes with no tab bar when only Notes is enabled", () => {
    const screen = render(
      <NotesJournalTabs date="2026-07-13" showNotes showJournal={false} />,
    );

    expect(screen.getByText("notes-view")).toBeTruthy();
    expect(screen.queryByText("journal-view")).toBeNull();
    expect(screen.queryByLabelText("Notes tab")).toBeNull();
    expect(screen.queryByLabelText("Journal tab")).toBeNull();
  });

  it("shows Journal with no tab bar when only Journal is enabled", () => {
    const screen = render(
      <NotesJournalTabs date="2026-07-13" showNotes={false} showJournal />,
    );

    expect(screen.getByText("journal-view")).toBeTruthy();
    expect(screen.queryByText("notes-view")).toBeNull();
    expect(screen.queryByLabelText("Notes tab")).toBeNull();
    expect(screen.queryByLabelText("Journal tab")).toBeNull();
  });

  it("shows a tab bar defaulting to Notes when both are enabled", () => {
    const screen = render(
      <NotesJournalTabs date="2026-07-13" showNotes showJournal />,
    );

    expect(screen.getByLabelText("Notes tab")).toBeTruthy();
    expect(screen.getByLabelText("Journal tab")).toBeTruthy();
    expect(screen.getByText("notes-view")).toBeTruthy();
    expect(screen.queryByText("journal-view")).toBeNull();
  });

  it("switches tabs on press, showing only the active surface", () => {
    const screen = render(
      <NotesJournalTabs date="2026-07-13" showNotes showJournal />,
    );

    fireEvent.press(screen.getByLabelText("Journal tab"));

    expect(screen.getByText("journal-view")).toBeTruthy();
    expect(screen.queryByText("notes-view")).toBeNull();

    fireEvent.press(screen.getByLabelText("Notes tab"));

    expect(screen.getByText("notes-view")).toBeTruthy();
    expect(screen.queryByText("journal-view")).toBeNull();
  });

  it("re-renders to the other tab if the active one is disabled", () => {
    const screen = render(
      <NotesJournalTabs date="2026-07-13" showNotes showJournal />,
    );

    fireEvent.press(screen.getByLabelText("Journal tab"));
    expect(screen.getByText("journal-view")).toBeTruthy();

    screen.rerender(
      <NotesJournalTabs date="2026-07-13" showNotes showJournal={false} />,
    );

    expect(screen.getByText("notes-view")).toBeTruthy();
    expect(screen.queryByText("journal-view")).toBeNull();
  });
});
