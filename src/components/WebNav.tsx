import { type Href, usePathname, useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  SettingsIcon,
  type TSettingsIconName,
} from "@/components/SettingsIcon";
import { getViewedDay } from "@/hooks/useViewedDay";
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
};

/**
 * The app's web navigation destinations, in rail order (top to bottom) and dock
 * order (left to right). Settings is last so it can be pinned to the bottom of
 * the rail, matching the legacy dexter-app's `mt-auto` gear.
 */
export const WEB_NAV_ITEMS: TWebNavItem[] = [
  { key: "today", href: "/today", label: "Today", icon: "sunny-outline" },
  { key: "search", href: "/search", label: "Search", icon: "search-outline" },
  {
    key: "settings",
    href: "/settings",
    label: "Settings",
    icon: "settings-outline",
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

  // Same contract as NewTaskButton's tab-bar accessory: read the viewed day at
  // press time, while the day screen is still focused — pushing the modal blurs
  // it, so reading later would always fall back to today.
  const openNewTask = () => {
    const viewedDay = getViewedDay();
    router.push(
      viewedDay
        ? {
            pathname: "/new-task",
            params: { scheduledFor: viewedDay.toString() },
          }
        : "/new-task",
    );
  };

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
                // Pins Settings — and the "+" that follows it — to the bottom of
                // the rail, the legacy nav's `mt-auto`.
                marginTop: item.key === "settings" ? "auto" : 0,
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
            <SettingsIcon color={color} name={item.icon} size={20} />
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
            styles.dockNewTaskIcon,
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
    justifyContent: "space-around",
    paddingTop: 8,
  },
  dockItem: {
    alignItems: "center",
    gap: 2,
  },
  dockLabel: {
    fontSize: 11,
  },
  dockNewTaskIcon: {
    alignItems: "center",
    height: 20,
    justifyContent: "center",
    width: 28,
  },
});
