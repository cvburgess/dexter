import { ReactNode } from "react";
import { Text, View } from "react-native";

import { useTheme } from "@/utils/theme";

type TSettingsSectionTitleProps = {
  children: ReactNode;
  /** A prop, not a separate component, so it can't drift from the title or
   * render after the section's content as a footnote. */
  subtitle?: ReactNode;
  testID?: string;
};

// Full `text`, sentence case — dimming or caps would read as competing
// emphasis. Owns its own surrounding space (the `lg` group step, DEX-61)
// rather than leaning on a parent `gap`, so it separates cleanly wherever
// it's rendered, including Search's result list.
export function SettingsSectionTitle({
  children,
  subtitle,
  testID,
}: TSettingsSectionTitleProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        // xs is the label-to-labelled step: subtitle belongs to the title above.
        gap: theme.space.xs,
        marginTop: theme.space.lg,
        marginBottom: theme.space.sm,
      }}
    >
      <Text
        style={{ ...theme.fonts.title, color: theme.colors.text }}
        testID={testID}
      >
        {children}
      </Text>

      {subtitle ? (
        // No weight override — at 600 a whole sentence reads as emphasis, not
        // explanation. Dimming past textSecondary starts looking disabled.
        <Text
          style={[theme.fonts.subtitle, { color: theme.colors.textSecondary }]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
