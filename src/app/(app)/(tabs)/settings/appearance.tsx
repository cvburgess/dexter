import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { SymbolView } from "expo-symbols";
import { ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { EThemeMode } from "@/api/preferences";
import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { usePreferences } from "@/hooks/usePreferences";
import { Theme, THEMES, themes, useTheme, withOpacity } from "@/utils/theme";

const MODE_OPTIONS: { mode: EThemeMode; label: string }[] = [
  { mode: EThemeMode.SYSTEM, label: "System" },
  { mode: EThemeMode.LIGHT, label: "Light" },
  { mode: EThemeMode.DARK, label: "Dark" },
];

const LIGHT_THEMES = THEMES.filter((t) => t.mode === "light");
const DARK_THEMES = THEMES.filter((t) => t.mode === "dark");

export default function AppearanceScreen() {
  const theme = useTheme();
  const [preferences, { updatePreferences }] = usePreferences();

  const { themeMode, lightTheme, darkTheme } = preferences;
  const showLight = themeMode !== EThemeMode.DARK;
  const showDark = themeMode !== EThemeMode.LIGHT;

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={[
        styles.content,
        { padding: theme.spacing, gap: theme.spacing },
      ]}
    >
      <Section title="Mode">
        <View testID="appearance-mode">
          <SegmentedControl
            values={MODE_OPTIONS.map(({ label }) => label)}
            selectedIndex={MODE_OPTIONS.findIndex(
              ({ mode }) => mode === themeMode,
            )}
            onChange={({ nativeEvent: { selectedSegmentIndex } }) =>
              updatePreferences({
                themeMode: MODE_OPTIONS[selectedSegmentIndex].mode,
              })
            }
          />
        </View>
      </Section>

      {showLight && (
        <Section title="Light theme">
          <View style={styles.cards}>
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
          <View style={styles.cards}>
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
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
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
          borderRadius: uiTheme.borderRadius,
          borderColor: selected
            ? uiTheme.colors.primary
            : withOpacity(uiTheme.colors.text, 0.1),
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
        },
      ]}
      testID={`appearance-theme-${name}`}
    >
      <View style={styles.swatches}>
        {swatches.map((color, i) => (
          <View
            key={i}
            style={[
              styles.swatch,
              { backgroundColor: color, borderRadius: uiTheme.borderRadius },
            ]}
          />
        ))}
      </View>
      <View style={styles.cardFooter}>
        <Text style={[styles.cardLabel, { color: palette.colors.text }]}>
          {label}
        </Text>
        {selected && (
          <SymbolView
            name="checkmark.circle.fill"
            size={18}
            tintColor={uiTheme.colors.primary}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    minWidth: 140,
    overflow: "hidden",
    padding: 12,
  },
  cardFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  cards: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  content: {
    flexGrow: 1,
  },
  section: {
    gap: 10,
  },
  swatch: {
    flex: 1,
    height: 28,
  },
  swatches: {
    flexDirection: "row",
    gap: 6,
  },
});
