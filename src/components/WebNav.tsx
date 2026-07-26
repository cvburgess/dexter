import { type Href, usePathname, useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  SettingsIcon,
  type TSettingsIconName,
} from "@/components/SettingsIcon";
import { newTaskRoute } from "@/utils/newTaskRoute";
import { useTheme, withOpacity } from "@/utils/theme";

// The string branch of `Href` — every nav destination is a static path, so the
// object form (`{pathname, params}`) never applies and prefix-matching an active
// route stays type-safe.
type TWebNavHref = Extract<Href, string>;

type TWebNavItem = {
  key: string;
  href: TWebNavHref;
  label: string;
  icon: TSettingsIconName;
  /** Floats this item (and everything after it) to the far end of the rail. */
  pinnedToBottom?: boolean;
};

/**
 * The app's web navigation destinations, in rail order (top to bottom) and dock
 * order (left to right). Keep in sync with the native tab triggers in
 * `app/(app)/(tabs)/_layout.tsx` when a tab is added or removed — the two
 * declarations are deliberately separate (different icon vocabularies, and web
 * adds a "+" that native hosts as a tab-bar accessory instead), so nothing
 * enforces it automatically.
 */
export const WEB_NAV_ITEMS: TWebNavItem[] = [
  { key: "today", href: "/today", label: "Today", icon: "sunny-outline" },
  { key: "search", href: "/search", label: "Search", icon: "search-outline" },
  {
    key: "settings",
    href: "/settings",
    label: "Settings",
    icon: "settings-outline",
    // The legacy nav's `mt-auto` gear. Declared rather than inferred from list
    // position, so reordering the array can't silently unpin it.
    pinnedToBottom: true,
  },
];

// Settings has nested routes (/settings/account, /settings/lists/[id]), so an
// exact match would drop the highlight as soon as a subview opens.
const isActive = (pathname: string, href: TWebNavHref) =>
  pathname === href || pathname.startsWith(`${href}/`);

/**
 * Shared behavior for both nav variants: which destination is current, how to
 * reach one, and how to open the create-task modal.
 */
function useWebNav() {
  const router = useRouter();
  const pathname = usePathname();

  // Resolved at press time, not render time — see `newTaskRoute`.
  const openNewTask = () => router.push(newTaskRoute());

  // `navigate` rather than `push`: these are tabs, so revisiting one should jump
  // back to it instead of stacking another copy onto the history.
  const go = (href: TWebNavHref) => router.navigate(href);

  return { go, openNewTask, pathname };
}

/**
 * The web navigation rail shown on wide viewports (see `(tabs)/_layout.web.tsx`).
 * Ports the legacy dexter-app's `DesktopNav`: a narrow full-height column of
 * floating rounded icon tiles on the sunken background, the active one filled
 * with the inverted ink color, and the gear pinned to the bottom. The "+" below
 * it is Dexter's create-task entry point on web (DEX-74).
 */
export function WebNavRail() {
  const theme = useTheme();
  const { go, openNewTask, pathname } = useWebNav();

  return (
    <View
      aria-label="Main navigation"
      role="navigation"
      style={[
        styles.rail,
        {
          backgroundColor: theme.colors.background,
          gap: theme.gap,
          paddingVertical: theme.spacing,
        },
      ]}
    >
      {WEB_NAV_ITEMS.map((item) => {
        const selected = isActive(pathname, item.href);

        return (
          <TouchableOpacity
            key={item.key}
            accessibilityLabel={item.label}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => go(item.href)}
            style={[
              styles.tile,
              {
                backgroundColor: selected
                  ? withOpacity(theme.colors.text, 0.8)
                  : theme.colors.card,
                borderRadius: theme.borderRadius,
                // Absorbs the rail's leftover height, pushing this item — and
                // the "+" that follows it — to the bottom.
                marginTop: item.pinnedToBottom ? "auto" : 0,
              },
            ]}
            testID={`web-nav-${item.key}`}
          >
            <SettingsIcon
              color={selected ? theme.colors.background : theme.colors.text}
              name={item.icon}
              size={26}
            />
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        accessibilityLabel="New Task"
        accessibilityRole="button"
        onPress={openNewTask}
        style={[
          styles.tile,
          {
            backgroundColor: theme.colors.primary,
            borderRadius: theme.borderRadius,
          },
        ]}
        testID="web-nav-new-task"
      >
        <SettingsIcon
          color={theme.colors.primaryContent}
          name="add"
          size={26}
        />
      </TouchableOpacity>
    </View>
  );
}

/**
 * The web navigation dock shown on narrow viewports — the legacy dexter-app's
 * `MobileNav`. Same destinations as the rail, laid out as a labelled bottom bar
 * with the active item tinted with the primary color instead of filled.
 */
export function WebNavDock() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { go, openNewTask, pathname } = useWebNav();

  return (
    <View
      aria-label="Main navigation"
      role="navigation"
      style={[
        styles.dock,
        {
          backgroundColor: theme.colors.background,
          borderTopColor: withOpacity(theme.colors.text, 0.1),
          // Mobile browsers put the home indicator / URL bar under the dock.
          paddingBottom: 8 + insets.bottom,
        },
      ]}
    >
      {WEB_NAV_ITEMS.map((item) => {
        const selected = isActive(pathname, item.href);
        const color = selected
          ? theme.colors.primary
          : withOpacity(theme.colors.text, 0.8);

        return (
          <TouchableOpacity
            key={item.key}
            accessibilityLabel={item.label}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => go(item.href)}
            style={styles.dockItem}
            testID={`web-nav-${item.key}`}
          >
            <View style={styles.dockIconSlot}>
              <SettingsIcon color={color} name={item.icon} size={20} />
            </View>
            <Text
              style={[
                styles.dockLabel,
                { color, fontWeight: selected ? "500" : "400" },
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        accessibilityLabel="New Task"
        accessibilityRole="button"
        onPress={openNewTask}
        style={styles.dockItem}
        testID="web-nav-new-task"
      >
        <View
          style={[
            styles.dockIconSlot,
            styles.dockNewTaskChip,
            {
              backgroundColor: theme.colors.primary,
              borderRadius: theme.borderRadius,
            },
          ]}
        >
          <SettingsIcon
            color={theme.colors.primaryContent}
            name="add"
            size={20}
          />
        </View>
        <Text
          style={[
            styles.dockLabel,
            { color: withOpacity(theme.colors.text, 0.8) },
          ]}
        >
          New Task
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    alignItems: "center",
    // Explicit rather than relying on the shell row's default `stretch`:
    // pinning the gear to the bottom (`marginTop: "auto"`) only works if the
    // rail actually fills the viewport height.
    alignSelf: "stretch",
    width: 76,
  },
  // Legacy parity: a 48pt square card that sits a step above the rail's sunken
  // background, lifted by a soft shadow rather than a border.
  tile: {
    alignItems: "center",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.12)",
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  dock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    paddingTop: 8,
  },
  // Equal columns rather than `space-around`, which would distribute around the
  // labels' differing widths and leave "New Task" crowding its neighbor.
  dockItem: {
    alignItems: "center",
    flex: 1,
    gap: 2,
  },
  // A fixed-height icon band so every label sits on the same baseline, whether
  // the item is a bare icon or the "+" chip below.
  dockIconSlot: {
    alignItems: "center",
    height: 24,
    justifyContent: "center",
  },
  dockLabel: {
    fontSize: 11,
  },
  // Wider than the icon band is tall so the glyph has breathing room inside the
  // primary fill instead of running edge to edge.
  dockNewTaskChip: {
    width: 34,
  },
});
