import { StyleSheet, Text, View } from "react-native";

import { TList } from "@/api/lists";
import { useLists } from "@/hooks/useLists";
import { withOpacity } from "@/utils/theme";

import { IconMenu, TIconMenuSection } from "./IconMenu";

type TListButtonProps = {
  listId: string | null;
  contentColor: string;
  onChangeList: (listId: string | null) => void;
};

export function ListButton({
  listId,
  contentColor,
  onChangeList,
}: TListButtonProps) {
  const [lists, { getListById }] = useLists();
  const selectedList = getListById(listId);
  const sections = getListSections(lists, listId, onChangeList);

  return (
    <IconMenu
      accessibilityLabel="List"
      menuTitle="List"
      sections={sections}
      style={styles.menu}
    >
      <View
        style={[
          styles.button,
          { borderColor: withOpacity(contentColor, 0.25) },
        ]}
      >
        <Text style={styles.glyph}>
          {selectedList ? selectedList.emoji : "🚫"}
        </Text>
      </View>
    </IconMenu>
  );
}

export const getListSections = (
  lists: TList[],
  listId: string | null,
  onChangeList: (listId: string | null) => void,
): TIconMenuSection[] => [
  {
    options: [
      ...lists.map((list) => ({
        id: list.id,
        title: `${list.emoji} ${list.title}`,
        isSelected: list.id === listId,
        onSelect: () => onChangeList(list.id),
      })),
      {
        id: "none",
        title: "None",
        isSelected: listId === null,
        onSelect: () => onChangeList(null),
      },
    ],
  },
];

const styles = StyleSheet.create({
  // Pin the trigger to the button's size so the menu wrapper can never
  // influence the task card row's height.
  menu: {
    height: 32,
    width: 32,
  },
  button: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  glyph: {
    fontSize: 16,
  },
});
