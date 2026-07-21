import { StyleSheet, Text, View } from "react-native";

import { ETaskStatus } from "@/api/tasks";
import { withOpacity } from "@/utils/theme";

import { IconMenu, TIconMenuSection } from "./IconMenu";

type TStatusButtonProps = {
  status: ETaskStatus;
  contentColor: string;
  onChangeStatus: (status: ETaskStatus) => void;
  /** Diameter in px. Subtask rows use 24 so they read as subordinate to the parent's 32. */
  size?: number;
  accessibilityLabel?: string;
};

const DEFAULT_SIZE = 32;

export function StatusButton({
  status,
  contentColor,
  onChangeStatus,
  size = DEFAULT_SIZE,
  accessibilityLabel = "Status",
}: TStatusButtonProps) {
  const sections = getStatusSections(onChangeStatus);

  return (
    <IconMenu
      accessibilityLabel={accessibilityLabel}
      menuTitle="Status"
      sections={sections}
      // The native menu host must be pinned to the trigger's exact size — left
      // to flex it reports 0 height while sizing and collapses the row.
      style={{ height: size, width: size }}
    >
      <View
        style={[
          styles.button,
          {
            borderColor: withOpacity(contentColor, 0.25),
            height: size,
            width: size,
          },
        ]}
      >
        <Text style={{ color: contentColor, fontSize: size / 2 }}>
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
  button: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
  },
});
