import { StyleSheet, Text, View } from "react-native";

import { ETaskStatus } from "@/api/tasks";
import { useTheme } from "@/utils/theme";

import { IconMenu, TIconMenuSection } from "./IconMenu";

type TStatusButtonProps = {
  status: ETaskStatus;
  onChangeStatus: (status: ETaskStatus) => void;
};

export function StatusButton({ status, onChangeStatus }: TStatusButtonProps) {
  const theme = useTheme();
  const sections = getStatusSections(status, onChangeStatus);

  return (
    <IconMenu
      accessibilityLabel="Status"
      menuTitle="Status"
      sections={sections}
    >
      <View
        style={[styles.button, { backgroundColor: theme.colors.background }]}
      >
        <Text style={[styles.glyph, { color: theme.colors.text }]}>
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
    options: [
      { id: "todo", title: "To Do", status: ETaskStatus.TODO },
      {
        id: "in-progress",
        title: "In Progress",
        status: ETaskStatus.IN_PROGRESS,
      },
      { id: "done", title: "Done", status: ETaskStatus.DONE },
      { id: "wont-do", title: "Won't Do", status: ETaskStatus.WONT_DO },
    ].map(({ status: optionStatus, ...option }) => ({
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
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  glyph: {
    fontSize: 16,
  },
});
