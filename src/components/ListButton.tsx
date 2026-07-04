import { StyleSheet, Text, View } from "react-native";

import { TList } from "@/api/lists";
import { useLists } from "@/hooks/useLists";
import { useTheme } from "@/utils/theme";

import { IconMenu, TIconMenuSection } from "./IconMenu";

type TListButtonProps = {
  listId: string | null;
  onChangeList: (listId: string | null) => void;
};

export function ListButton({ listId, onChangeList }: TListButtonProps) {
  const theme = useTheme();
  const [lists, { getListById }] = useLists();
  const selectedList = getListById(listId);
  const sections = getListSections(lists, listId, onChangeList);

  return (
    <IconMenu accessibilityLabel="List" menuTitle="List" sections={sections}>
      <View
        style={[styles.button, { backgroundColor: theme.colors.background }]}
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
  button: {
    alignItems: "center",
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  glyph: {
    fontSize: 16,
  },
});
