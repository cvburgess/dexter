import { ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { EThemeMode } from "@/api/preferences";
import {
  SegmentedControl,
  TSegmentedControlOption,
} from "@/components/SegmentedControl";
import { Icon } from "@/components/Icon";
import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { usePreferences } from "@/hooks/usePreferences";
import {
  EDGES_SINGLE_PANE,
  EDGES_TWO_PANE,
} from "@/utils/settingsSafeAreaEdges";
import { Theme, THEMES, themes, useTheme } from "@/utils/theme";

const MODE_OPTIONS: TSegmentedControlOption<EThemeMode>[] = [
  { value: EThemeMode.SYSTEM, label: "System" },
  { value: EThemeMode.LIGHT, label: "Light" },
  { value: EThemeMode.DARK, label: "Dark" },
];

const LIGHT_THEMES = THEMES.filter((t) => t.mode === "light");
const DARK_THEMES = THEMES.filter((t) => t.mode === "dark");

export default function AppearanceScreen() {
  const theme = useTheme();
  const [preferences, { updatePreferences }] = usePreferences();
  const twoPane = useIsLargeDevice();
  const insets = useSafeAreaInsets();

  const { themeMode, lightTheme, darkTheme } = preferences;
  const showLight = themeMode !== EThemeMode.DARK;
  const showDark = themeMode !== EThemeMode.LIGHT;

  return (
    <SafeAreaView
      edges={twoPane ? EDGES_TWO_PANE : EDGES_SINGLE_PANE}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        // The edges above omit `bottom` so content scrolls under the
        // translucent tab bar; adding the inset to the content's own bottom
        // padding is what lets the last theme card clear it (DEX-91).
        contentContainerStyle={[
          styles.content,
          {
            padding: theme.space.md,
            paddingBottom: theme.space.md + insets.bottom,
            // `lg` between sections, `sm` within one (`Section`): the groups had
            // been separated by the same step that separated a title from its
            // own content, so nothing read as grouped (DEX-61).
            gap: theme.space.lg,
          },
        ]}
      >
        <Section title="Mode">
          <SegmentedControl
            options={MODE_OPTIONS}
            testIDPrefix="appearance-mode"
            value={themeMode}
            onChange={(mode) => updatePreferences({ themeMode: mode })}
          />
        </Section>

        {showLight && (
          <Section title="Light theme">
            <View style={[styles.cards, { gap: theme.space.sm }]}>
              {LIGHT_THEMES.map(({ name, label }) => (
                <ThemeCard
                  key={name}
                  name={name}
                  label={label}
                  selected={name === lightTheme}
                  uiTheme={theme}
                  onPress={() => updatePreferences({ lightTheme: name })}
                />
              ))}
            </View>
          </Section>
        )}

        {showDark && (
          <Section title="Dark theme">
            <View style={[styles.cards, { gap: theme.space.sm }]}>
              {DARK_THEMES.map(({ name, label }) => (
                <ThemeCard
                  key={name}
                  name={name}
                  label={label}
                  selected={name === darkTheme}
                  uiTheme={theme}
                  onPress={() => updatePreferences({ darkTheme: name })}
                />
              ))}
            </View>
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.sm }}>
      <SettingsSectionTitle>{title}</SettingsSectionTitle>
      {children}
    </View>
  );
}

function ThemeCard({
  name,
  label,
  selected,
  uiTheme,
  onPress,
}: {
  name: string;
  label: string;
  selected: boolean;
  uiTheme: Theme;
  onPress: () => void;
}) {
  const palette = themes[name];
  // A miniature preview of the theme: its own surface with a row of accent
  // swatches drawn from the same tokens the app uses (primary + priorities).
  const swatches = [
    palette.colors.primary,
    palette.colors.priority[0],
    palette.colors.priority[1],
    palette.colors.priority[2],
  ];

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: palette.colors.card,
          borderRadius: uiTheme.radii.md,
          borderColor: selected
            ? uiTheme.colors.primary
            : uiTheme.colors.border,
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
          gap: uiTheme.space.sm,
          // `md`, the standard inset: the card is a miniature of the app's own
          // surface, so it reads better with the gutter a real pane would have
          // than with the tighter in-group step the row between cards uses.
          padding: uiTheme.space.md,
        },
      ]}
      testID={`appearance-theme-${name}`}
    >
      <View style={[styles.swatches, { gap: uiTheme.space.xs }]}>
        {swatches.map((color, i) => (
          <View
            key={i}
            style={[
              styles.swatch,
              {
                backgroundColor: color,
                borderRadius: uiTheme.radii.md,
                height: uiTheme.controls.sm,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.cardFooter}>
        <Text style={[uiTheme.fonts.title, { color: palette.colors.text }]}>
          {label}
        </Text>
        {selected && (
          <Icon
            sf="checkmark.circle.fill"
            ionicon="checkmark-circle"
            color={uiTheme.colors.primary}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    // Wide enough for the longest theme name beside its checkmark; the swatch
    // row below it has no intrinsic width of its own.
    minWidth: 140,
    overflow: "hidden",
  },
  cardFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  // The row wraps, so its gap (applied inline, since it's density-dependent)
  // separates the cards both across and down — a wrapped second row needs the
  // same breathing room as the one above it.
  cards: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  content: {
    flexGrow: 1,
  },
  screen: {
    flex: 1,
  },
  swatch: {
    flex: 1,
  },
  swatches: {
    flexDirection: "row",
  },
});
