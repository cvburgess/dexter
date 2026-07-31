import { ReactNode } from "react";
import { Text, View } from "react-native";

import { useTheme } from "@/utils/theme";

type TSettingsSectionTitleProps = {
  children: ReactNode;
  /**
   * The explanatory line under the title — what the section is for, or what
   * changing it will and won't do. A prop rather than a separate component so
   * it can't drift away from the title it explains, or end up rendered after
   * the section's content as a footnote.
   */
  subtitle?: ReactNode;
  testID?: string;
};

/**
 * The label heading a group of settings, with its optional subtitle.
 *
 * Drawn at full `text`, not `textSecondary`: it is the section's heading, and
 * dimming it put it below its own subtitle in the visual order. Sentence case,
 * not uppercase — it is a `title` at the same size as the rows it heads, and
 * caps on top of that read as a second, competing emphasis. Write the copy in
 * sentence case at the call site; nothing transforms it here.
 *
 * **This owns the space around itself**, unlike most components here, which
 * leave spacing to the parent's `gap`. A section's rows are a group and the
 * heading is not one of them, so the margins are what set it apart from both
 * the section above and the content below — a uniform `gap` on the parent
 * can't say that. The margins add to that gap rather than replacing it.
 */
export function SettingsSectionTitle({
  children,
  subtitle,
  testID,
}: TSettingsSectionTitleProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        // `xs` is the label-to-labelled step: the subtitle belongs to the title
        // above it, so the pair reads as one heading.
        gap: theme.space.xs,
        marginTop: theme.space.sm,
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
        // `subtitle` carries the 400 weight itself, so there is no override
        // here: this is running prose, and at the 600 a label wants, a whole
        // sentence of it read as emphasis rather than explanation. Weight is
        // what separates it from the title — dimming further doesn't work,
        // because past `textSecondary` the text starts looking disabled.
        <Text
          style={[theme.fonts.subtitle, { color: theme.colors.textSecondary }]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
