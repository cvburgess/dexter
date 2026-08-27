import { type Href, Link, usePathname, useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  SettingsIcon,
  type TSettingsIconName,
} from "@/components/SettingsIcon";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import {
  NAV_ICON_SIZE,
  NAV_RAIL_WIDTH,
  NAV_TILE_SIZE,
} from "@/utils/breakpoints";
import { newTaskRoute } from "@/utils/newTaskRoute";
import {
  SHADOW_LG,
  SHADOW_MD,
  Theme,
  useTheme,
  withOpacity,
} from "@/utils/theme";

// The string branch of `Href`: every destination is a static path, and
// prefix-matching the active route needs a string.
type TNavHref = Extract<Href, string>;

type TNavItem = {
  key: string;
  href: TNavHref;
  label: string;
  icon: TSettingsIconName;
  /** Floats this item (and everything after it) to the far end of the rail. */
  pinnedToBottom?: boolean;
  /**
   * Hides the destination below `LARGE_DEVICE_MIN_WIDTH` (DEX-96); the route
   * stays registered either way — only the nav affordance goes.
   */
  largeScreenOnly?: boolean;
};

/**
 * Nav destinations in rail/dock order. Nothing syncs this with the phone tab
 * triggers in `app/(app)/(tabs)/_layout.tsx` — keep the two aligned by hand.
 */
export const NAV_ITEMS: TNavItem[] = [
  { key: "today", href: "/today", label: "Today", icon: "sunny-outline" },
  // One route at every width (DEX-127), and one fixed glyph: an icon that
  // changed at noon would read as a different destination.
  { key: "ritual", href: "/ritual", label: "Ritual", icon: "moon-outline" },
  {
    key: "week",
    href: "/week",
    label: "Week",
    icon: "calendar-outline",
    largeScreenOnly: true,
  },
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
const isActive = (pathname: string, href: TNavHref) =>
  pathname === href || pathname.startsWith(`${href}/`);

/**
 * Shared behavior for both nav variants; destinations are `Link`s rather than
 * handlers — see `navItemProps`.
 */
function useAppNav() {
  const router = useRouter();
  const pathname = usePathname();
  const largeDevice = useIsLargeDevice();

  // Resolved at press time, not render time — see `newTaskRoute`.
  const openNewTask = () => router.push(newTaskRoute());

  // Filtered here rather than in each variant so the rail and the dock always
  // offer the same destinations.
  const items = NAV_ITEMS.filter(
    (item) => largeDevice || !item.largeScreenOnly,
  );

  return { items, openNewTask, pathname };
}

/** On a `Pressable` child of `asChild` Link — `Text` wrapping breaks flex
 * layout, `TouchableOpacity` swallows `href`/`aria-current`. */
const navItemProps = (item: TNavItem, selected: boolean) => ({
  accessibilityLabel: item.label,
  accessibilityState: { selected },
  "aria-current": selected ? ("page" as const) : undefined,
  testID: `nav-${item.key}`,
});

/**
 * The rail: every tablet at every width, web above `RAIL_MIN_WIDTH`. Its "+" is
 * the create-task entry point wherever it renders (DEX-74, DEX-104).
 */
export function NavRail() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { items, openNewTask, pathname } = useAppNav();

  return (
    <View
      aria-label="Main navigation"
      role="navigation"
      style={[
        styles.rail,
        {
          // Sunken chrome (DEX-61); the tiles' own `background` fill is what
          // lifts them off it.
          backgroundColor: theme.colors.surfaceSunken,
          // `lg`, the group step — and shadow-md's 4pt drop needs the room, or
          // tiles cast onto each other.
          gap: theme.space.lg,
          // Owns top/bottom/left insets (right belongs to content); width
          // *grows* by the left inset, or a cutout would squeeze the tiles.
          paddingBottom: theme.space.md + insets.bottom,
          paddingLeft: insets.left,
          paddingTop: theme.space.md + insets.top,
          width: NAV_RAIL_WIDTH + insets.left,
        },
      ]}
    >
      {items.map((item) => (
        <NavRailTile
          item={item}
          key={item.key}
          selected={isActive(pathname, item.href)}
        />
      ))}

      <TouchableOpacity
        accessibilityLabel="New Task"
        accessibilityRole="button"
        onPress={openNewTask}
        style={[
          styles.tile,
          tileStyle(theme),
          { backgroundColor: theme.colors.primary },
        ]}
        testID="nav-new-task"
      >
        <SettingsIcon
          color={theme.colors.primaryContent}
          name="add"
          size={NAV_ICON_SIZE}
        />
      </TouchableOpacity>
    </View>
  );
}

/**
 * One rail destination. Hover state lives in React because the flattened style
 * below rules out `Pressable`'s style-function form.
 */
function NavRailTile({
  item,
  selected,
}: {
  item: TNavItem;
  selected: boolean;
}) {
  const theme = useTheme();
  const [hovered, setHovered] = useState(false);

  return (
    <Link asChild href={item.href}>
      <Pressable
        {...navItemProps(item, selected)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        // Flattened, not an array: `Link`'s `Slot` clones this child and
        // can't merge an array style with the props it injects.
        style={StyleSheet.flatten([
          styles.tile,
          tileStyle(theme, hovered),
          {
            backgroundColor: selected
              ? withOpacity(theme.colors.text, 0.8)
              : theme.colors.background,
            // Absorbs the rail's leftover height, pushing this item — and
            // the "+" that follows it — to the bottom.
            marginTop: item.pinnedToBottom ? "auto" : 0,
          },
        ])}
      >
        <SettingsIcon
          color={selected ? theme.colors.background : theme.colors.text}
          name={item.icon}
          size={NAV_ICON_SIZE}
        />
      </Pressable>
    </Link>
  );
}

/**
 * The dock for narrow web viewports — web-only in practice (phones get native
 * tabs, tablets the rail at every width, DEX-104), kept platform-neutral.
 */
export function NavDock() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { items, openNewTask, pathname } = useAppNav();

  return (
    <View
      aria-label="Main navigation"
      role="navigation"
      style={[
        styles.dock,
        {
          // Sunken for the same reason as the rail above.
          backgroundColor: theme.colors.surfaceSunken,
          borderTopColor: theme.colors.border,
          paddingTop: theme.space.sm,
          // Inert today — web insets need `viewport-fit=cover`, which Expo's
          // default template lacks — but correct the day that changes.
          paddingBottom: theme.space.sm + insets.bottom,
        },
      ]}
    >
      {items.map((item) => {
        const selected = isActive(pathname, item.href);
        const color = selected
          ? theme.colors.primary
          : withOpacity(theme.colors.text, 0.8);

        return (
          <Link asChild href={item.href} key={item.key}>
            <Pressable
              {...navItemProps(item, selected)}
              // Flattened for the same reason as the rail's tile above.
              style={StyleSheet.flatten([
                styles.dockItem,
                { gap: theme.space.xs },
              ])}
            >
              <View style={[styles.dockIconSlot, iconSlotStyle(theme)]}>
                <SettingsIcon
                  color={color}
                  name={item.icon}
                  size={theme.icons.md}
                />
              </View>
              <Text
                style={[
                  theme.fonts.body,
                  { color, fontWeight: selected ? "500" : "400" },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          </Link>
        );
      })}

      <TouchableOpacity
        accessibilityLabel="New Task"
        accessibilityRole="button"
        onPress={openNewTask}
        style={[styles.dockItem, { gap: theme.space.xs }]}
        testID="nav-new-task"
      >
        <View
          style={[
            styles.dockIconSlot,
            iconSlotStyle(theme),
            {
              backgroundColor: theme.colors.primary,
              borderRadius: theme.radii.md,
              // Wider than the icon band is tall so the glyph has breathing room
              // inside the primary fill instead of running edge to edge.
              width: theme.icons.md + theme.space.md,
            },
          ]}
        >
          <SettingsIcon
            color={theme.colors.primaryContent}
            name="add"
            size={theme.icons.md}
          />
        </View>
        <Text
          style={[
            theme.fonts.body,
            { color: withOpacity(theme.colors.text, 0.8) },
          ]}
        >
          New Task
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/** The rail tile's box; see `NavRail` and `NAV_TILE_SIZE`. */
const tileStyle = (theme: Theme, hovered = false) => ({
  borderRadius: theme.radii.md,
  boxShadow: hovered ? SHADOW_LG : SHADOW_MD,
  height: NAV_TILE_SIZE,
  width: NAV_TILE_SIZE,
});

/**
 * A fixed-height icon band so every dock label sits on the same baseline,
 * whether the item is a bare icon or the "+" chip beside it.
 */
const iconSlotStyle = (theme: Theme) => ({
  height: theme.icons.md + theme.space.xs,
});

const styles = StyleSheet.create({
  rail: {
    alignItems: "center",
    // Pinning the gear with `marginTop: "auto"` only works if the rail
    // actually fills the viewport height.
    alignSelf: "stretch",
    // `width` is set inline, not here: it varies with the left safe-area inset.
  },
  // Lifted off the rail's sunken background by a soft shadow rather than a
  // border; `tileStyle` carries the box.
  tile: {
    alignItems: "center",
    justifyContent: "center",
  },
  dock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
  },
  // Equal columns rather than `space-around`, which would distribute around the
  // labels' differing widths and leave "New Task" crowding its neighbor.
  dockItem: {
    alignItems: "center",
    flex: 1,
  },
  dockIconSlot: {
    alignItems: "center",
    justifyContent: "center",
  },
});
