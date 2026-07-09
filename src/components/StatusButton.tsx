import { StyleSheet, Text, View } from "react-native";

import { ETaskStatus } from "@/api/tasks";
import { withOpacity } from "@/utils/theme";

import { IconMenu, TIconMenuSection } from "./IconMenu";

type TStatusButtonProps = {
  status: ETaskStatus;
  contentColor: string;
  onChangeStatus: (status: ETaskStatus) => void;
};

export function StatusButton({
  status,
  contentColor,
  onChangeStatus,
}: TStatusButtonProps) {
  const sections = getStatusSections(onChangeStatus);

  return (
    <IconMenu
      accessibilityLabel="Status"
      menuTitle="Status"
      sections={sections}
      // Pin the native menu host to the trigger's size. Without explicit
      // dimensions, @expo/ui's Host sizes itself asynchronously from SwiftUI
      // (matchContents), and on the new architecture that late report can
      // momentarily be 0 or wrong — collapsing or ballooning the task card row.
      style={styles.menu}
    >
      <View
        style={[
          styles.button,
          { borderColor: withOpacity(contentColor, 0.25) },
        ]}
      >
        <Text style={[styles.glyph, { color: contentColor }]}>
          {glyphForStatus(status)}
        </Text>
      </View>
    </IconMenu>
  );
}

export const getStatusSections = (
  onChangeStatus: (status: ETaskStatus) => void,
): TIconMenuSection[] => [
  {
    options: (
      [
        {
          id: "todo",
          title: "To Do",
          status: ETaskStatus.TODO,
          icon: { ios: "circle", android: "circle", web: "circle" },
        },
        {
          id: "in-progress",
          title: "In Progress",
          status: ETaskStatus.IN_PROGRESS,
          icon: {
            ios: "circle.lefthalf.filled",
            android: "contrast",
            web: "contrast",
          },
        },
        {
          id: "done",
          title: "Done",
          status: ETaskStatus.DONE,
          icon: { ios: "checkmark", android: "check", web: "check" },
        },
        {
          id: "wont-do",
          title: "Won't Do",
          status: ETaskStatus.WONT_DO,
          icon: { ios: "xmark", android: "close", web: "close" },
        },
      ] as const
    ).map(({ status: optionStatus, ...option }) => ({
      ...option,
      // No isSelected: the icons say it all, and the trigger glyph already
      // reflects the current status — skip the menu checkmark.
      onSelect: () => onChangeStatus(optionStatus),
    })),
  },
];

const glyphForStatus = (status: ETaskStatus) => {
  switch (status) {
    case ETaskStatus.IN_PROGRESS:
      return "◐";
    case ETaskStatus.DONE:
      return "✓";
    case ETaskStatus.WONT_DO:
      return "✕";
    case ETaskStatus.TODO:
    default:
      return "○";
  }
};

const styles = StyleSheet.create({
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
