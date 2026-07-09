import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { StyleSheet } from "react-native";

import { TList } from "@/api/lists";

import { useLists } from "@/hooks/useLists";

import { getListSections, ListButton } from "../ListButton";

jest.mock("@/hooks/useLists", () => ({ useLists: jest.fn() }));

const mockIconMenu = jest.fn(
  (props: { children: ReactNode }) => props.children,
);
jest.mock("../IconMenu", () => ({
  IconMenu: (props: Parameters<typeof mockIconMenu>[0]) => mockIconMenu(props),
}));

const mockUseLists = useLists as jest.MockedFunction<typeof useLists>;

const lists: TList[] = [
  {
    id: "list-1",
    title: "Work",
    emoji: "💼",
    isArchived: false,
    createdAt: "",
  },
  {
    id: "list-2",
    title: "Home",
    emoji: "🏠",
    isArchived: false,
    createdAt: "",
  },
];

describe("getListSections", () => {
  it("lists every list plus a None option, with the current one selected", () => {
    const onChangeList = jest.fn();
    const [section] = getListSections(lists, "list-2", onChangeList);

    expect(section.options.map((option) => option.id)).toEqual([
      "list-1",
      "list-2",
      "none",
    ]);
    expect(section.options.map((option) => option.isSelected)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it("selects None when listId is null", () => {
    const [section] = getListSections(lists, null, jest.fn());

    expect(
      section.options.find((option) => option.id === "none")?.isSelected,
    ).toBe(true);
  });

  it("calls onChangeList with the selected list id", () => {
    const onChangeList = jest.fn();
    const [section] = getListSections(lists, null, onChangeList);

    section.options.find((option) => option.id === "list-1")?.onSelect();

    expect(onChangeList).toHaveBeenCalledWith("list-1");
  });
});

describe("ListButton", () => {
  it("shows the selected list's emoji", () => {
    mockUseLists.mockReturnValue([
      lists,
      {
        createList: jest.fn(),
        isLoading: false,
        deleteList: jest.fn(),
        updateList: jest.fn(),
        getListById: (id) => lists.find((list) => list.id === id),
      },
    ]);

    const screen = render(
      <ListButton
        listId="list-2"
        contentColor="#000000"
        onChangeList={jest.fn()}
      />,
    );

    expect(screen.getByText("🏠")).toBeTruthy();
  });

  it("shows a placeholder when no list is selected", () => {
    mockUseLists.mockReturnValue([
      lists,
      {
        createList: jest.fn(),
        isLoading: false,
        deleteList: jest.fn(),
        updateList: jest.fn(),
        getListById: () => undefined,
      },
    ]);

    const screen = render(
      <ListButton
        listId={null}
        contentColor="#000000"
        onChangeList={jest.fn()}
      />,
    );

    expect(screen.getByText("🚫")).toBeTruthy();
  });

  it("cages the native menu host in a fixed 32×32 frame", () => {
    // See StatusButton: the host overrides styles passed to it, so only a
    // plain fixed-size wrapper keeps it from resizing the task card row.
    mockUseLists.mockReturnValue([
      lists,
      {
        createList: jest.fn(),
        isLoading: false,
        deleteList: jest.fn(),
        updateList: jest.fn(),
        getListById: () => undefined,
      },
    ]);

    const screen = render(
      <ListButton
        listId={null}
        contentColor="#000000"
        onChangeList={jest.fn()}
      />,
    );

    const frame = screen.getByTestId("list-menu-frame");
    expect(StyleSheet.flatten(frame.props.style)).toMatchObject({
      height: 32,
      width: 32,
      overflow: "hidden",
    });
    expect(mockIconMenu).toHaveBeenCalledWith(
      expect.objectContaining({ style: { height: 32, width: 32 } }),
    );
  });
});
