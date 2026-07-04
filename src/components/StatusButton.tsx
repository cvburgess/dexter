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
  const sections = getStatusSections(status, onChangeStatus);

  return (
    <IconMenu
      accessibilityLabel="Status"
      menuTitle="Status"
      sections={sections}
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
  status: ETaskStatus,
  onChangeStatus: (status: ETaskStatus) => void,
): TIconMenuSection[] => [
  {
    options: ([
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
    ] as const).map(({ status: optionStatus, ...option }) => ({
      ...option,
      isSelected: status === optionStatus,
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
