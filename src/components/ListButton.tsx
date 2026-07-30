import { StyleSheet, Text, View } from "react-native";

import { TList } from "@/api/lists";
import { useLists } from "@/hooks/useLists";
import { useTheme, withOpacity } from "@/utils/theme";

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
  const theme = useTheme();
  const [lists, { getListById }] = useLists();
  const selectedList = getListById(listId);
  const sections = getListSections(lists, listId, onChangeList);
  // Pin the trigger to the button's size so the menu wrapper can never
  // influence the task card row's height.
  const box = { height: theme.controls.sm, width: theme.controls.sm };

  return (
    <IconMenu
      accessibilityLabel="List"
      menuTitle="List"
      sections={sections}
      style={box}
    >
      <View
        style={[
          styles.button,
          box,
          {
            // Content-derived, like the status circle: a neutral hairline would
            // wash out against the priority fill behind it.
            borderColor: withOpacity(contentColor, 0.25),
            borderRadius: theme.radii.full,
          },
        ]}
      >
        <Text style={{ fontSize: theme.fonts.title.fontSize }}>
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
    borderWidth: 1,
    justifyContent: "center",
  },
});
