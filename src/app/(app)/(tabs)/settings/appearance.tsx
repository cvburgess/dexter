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
        // Edges omit `bottom`; the content padding lets the last theme card
        // clear the translucent tab bar (DEX-91).
        contentContainerStyle={[
          styles.content,
          {
            padding: theme.space.md,
            paddingBottom: theme.space.md + insets.bottom,
            gap: theme.space.sm,
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
          backgroundColor: palette.colors.surfaceSunken,
          borderRadius: uiTheme.radii.md,
          borderColor: selected
            ? uiTheme.colors.primary
            : uiTheme.colors.border,
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
          // `md`, not the in-group `sm` — at `sm` the name crowded the color
          // it names, reading as a caption rather than one card (DEX-109).
          gap: uiTheme.space.md,
          padding: uiTheme.space.md,
        },
      ]}
      testID={`appearance-theme-${name}`}
    >
      <View
        style={[styles.swatches, { gap: uiTheme.space.xs }]}
        testID={`appearance-swatches-${name}`}
      >
        {swatches.map((color, i) => (
          <View
            key={i}
            style={{
              backgroundColor: color,
              // A circle: `full` radius, box square rather than stretched.
              borderRadius: uiTheme.radii.full,
              height: uiTheme.space.lg,
              width: uiTheme.space.lg,
            }}
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
    // Wide enough for the longest theme name and, not by accident, the
    // swatch row: four space.lg circles + three space.xs gaps = 108.
    minWidth: 140,
    overflow: "hidden",
  },
  cardFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  // Wraps; the inline gap separates cards both across and down.
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
  swatches: {
    flexDirection: "row",
  },
});
