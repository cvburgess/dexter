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
import { Theme, useTheme, withOpacity } from "@/utils/theme";

// The string branch of `Href` — every nav destination is a static path, so the
// object form (`{pathname, params}`) never applies and prefix-matching an active
// route stays type-safe.
type TNavHref = Extract<Href, string>;

type TNavItem = {
  key: string;
  href: TNavHref;
  label: string;
  icon: TSettingsIconName;
  /** Floats this item (and everything after it) to the far end of the rail. */
  pinnedToBottom?: boolean;
  /**
   * Hides this destination below `LARGE_DEVICE_MIN_WIDTH` (DEX-96). Declared
   * on the item rather than filtered at each render site so the rail and the
   * dock can't disagree about which destinations exist — the same reasoning as
   * `pinnedToBottom`. The route stays registered either way; only the nav
   * affordance goes away.
   */
  largeScreenOnly?: boolean;
};

/**
 * The app's navigation destinations, in rail order (top to bottom) and dock
 * order (left to right). Keep in sync with the native tab triggers in
 * `app/(app)/(tabs)/_layout.tsx` when a tab is added or removed — the two
 * declarations are deliberately separate (different icon vocabularies, and this
 * list adds a "+" that the native tab bar hosts as an accessory instead), so
 * nothing enforces it automatically. That sync is narrower than it used to be:
 * since DEX-104 the native triggers are the **phone** tab bar only, so a
 * tablet-or-wider destination like Week lives here alone.
 */
export const NAV_ITEMS: TNavItem[] = [
  { key: "today", href: "/today", label: "Today", icon: "sunny-outline" },
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
 * Shared behavior for both nav variants: which destination is current, and how
 * to open the create-task modal. Destinations themselves are `Link`s rather than
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

/**
 * The props every destination's pressable shares across both variants.
 *
 * These go on the child of an `asChild` `Link`, not on the `Link` itself. A bare
 * `Link` wraps its children in a `Text`, and a text box doesn't lay its children
 * out as a flex container — the tile's `alignItems`/`justifyContent` centering
 * (and the dock item's `flex`/`gap`) silently stop applying, leaving the icon
 * parked at the text origin. Handing `Link` a `View`-backed child instead keeps
 * flex layout *and* the real anchor: react-native-web's `View` renders an `<a>`
 * whenever it's given an `href`, exactly like `Text` does.
 *
 * The child has to be a `Pressable`, not a `TouchableOpacity`: `Link`'s `Slot`
 * hands the child its `href`, and only `Pressable` spreads unrecognized props
 * through to the underlying `View`. `TouchableOpacity` forwards a fixed prop
 * set, which swallows both `href` and `aria-current` — the anchor and the
 * screen-reader cue would silently vanish.
 *
 * `aria-current="page"` is what actually marks the active destination for
 * assistive tech: `accessibilityState.selected` maps to `aria-selected`, which
 * only carries meaning on tab/option/row roles and is ignored on a link. It's
 * kept alongside because it's the cross-platform signal (and what the tests
 * assert), but `aria-current` is the one a screen reader announces here.
 */
const navItemProps = (item: TNavItem, selected: boolean) => ({
  accessibilityLabel: item.label,
  accessibilityState: { selected },
  "aria-current": selected ? ("page" as const) : undefined,
  testID: `nav-${item.key}`,
});

/**
 * The navigation rail: on **every tablet** at every width, and on web above
 * `RAIL_MIN_WIDTH` (see `components/AppShell.tsx`). Ports the legacy
 * dexter-app's `DesktopNav`: a narrow full-height column of floating rounded
 * icon tiles on the sunken background, the active one filled with the inverted
 * ink color, and the gear pinned to the bottom. The "+" below it is Dexter's
 * create-task entry point wherever this renders (DEX-74, DEX-104) — including
 * Android tablets, which have never had one, since the iOS `BottomAccessory`
 * that hosts it on phones has no Android equivalent.
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
          // Sunken, not `background`: the rail is chrome beside the content
          // pane, and on the same surface the two read as one sheet (DEX-61).
          // The tiles' own `background` fill is what lifts them off it — they
          // read as pieces of the content sheet floating on the chrome.
          backgroundColor: theme.colors.surfaceSunken,
          // `lg`, the group step: each tile is its own destination rather than
          // one control in a cluster, and at `md` they read as a stack. The
          // shadow needs the room too — `shadow-md` drops 4pt with a 6pt blur,
          // so tiles a tight gap apart cast onto each other.
          gap: theme.space.lg,
          // The rail owns the physical left edge with nothing above it, so it
          // absorbs three insets — the same reasoning as `SettingsSidebar`,
          // which is the other component that holds an edge in a two-pane
          // layout. `top` because there is no stack header to clear the status
          // bar for it, `bottom` so the home indicator doesn't cross the "+",
          // and `left` for a landscape display cutout. `right` is deliberately
          // unclaimed: the content pane is on that side.
          //
          // The width *grows* by the left inset rather than padding into the
          // fixed 76dp, or a cutout would squeeze the tiles it's meant to clear.
          // All three are 0 on web (no `viewport-fit=cover` — see `NavDock`),
          // so this reduces to exactly the previous `width`/`paddingVertical`
          // there. Unlike `SettingsSidebar` the rail takes no extra web-side
          // padding: that compensates for a heading, and the top tile doesn't
          // need it.
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
 * One rail destination.
 *
 * A component of its own so it can hold its own hover state. The tile's style
 * has to be flattened (see below), which rules out `Pressable`'s style-function
 * form — the usual way to read `hovered` — so the state is lifted into React
 * instead. Ports dexter-app's `hover:shadow-lg transition-shadow`, minus the
 * transition: RN has no CSS transitions, so the lift snaps rather than eases.
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
 * The navigation dock shown on narrow **web** viewports — the legacy
 * dexter-app's `MobileNav`. Same destinations as the rail, laid out as a
 * labelled bottom bar with the active item tinted with the primary color
 * instead of filled.
 *
 * Web-only in practice, unlike the rail: phones render the native tab bar and
 * tablets render the rail at every width (DEX-104), so nothing native reaches
 * this. Kept platform-neutral anyway — it costs nothing and the narrow-window
 * case is the one most likely to want it back.
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
          // Reserves the home-indicator inset. Inert as things stand: on web
          // react-native-safe-area-context reads `env(safe-area-inset-*)`,
          // which only resolves non-zero when the page opts into
          // `viewport-fit=cover` — Expo's default web template (this app has no
          // `public/index.html` override) does not. Kept so the dock is already
          // correct if that ever changes.
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
              // Flattened for the same reason as the rail's tile above — the
              // `Slot` behind `asChild` can't merge an array style with the
              // props it injects, and errors out instead of styling the item.
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

/**
 * Tailwind v4's `shadow-md` and `shadow-lg` — the exact pair dexter-app's
 * `Nav.tsx` lifts its tiles with (`shadow-md hover:shadow-lg`), ported
 * literally rather than approximated. Both are two-layer: a wide soft drop with
 * a negative spread, plus a tighter second layer that keeps the tile's own edge
 * defined. What this app drew before was a single `0 1px 3px` — effectively the
 * first half of Tailwind's `shadow-sm`, a rung down and missing the second
 * layer, which read as a smudged hairline rather than a lift.
 *
 * Black, not `colors.text`: a shadow is the absence of light on every theme,
 * the same reason a divider is always darker than what it divides. Deriving it
 * from the ink painted a pale halo around the tiles on the dark themes — see
 * docs/design.md, "Scrims and shadows".
 *
 * The CSS string form renders on native too, so the rail keeps its lift on a
 * tablet: RN 0.86's `processBoxShadow` parses it (negative spread included) and
 * `@react-native/normalize-colors` handles the `rgb(R G B / A)` slash notation
 * used here. No `shadow*`/`elevation` fallback is needed.
 */
const TILE_SHADOW =
  "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)";
const TILE_SHADOW_HOVER =
  "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)";

/** The rail tile's box; see `NavRail` and `NAV_TILE_SIZE`. */

const tileStyle = (theme: Theme, hovered = false) => ({
  borderRadius: theme.radii.md,
  boxShadow: hovered ? TILE_SHADOW_HOVER : TILE_SHADOW,
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
    // Explicit rather than relying on the shell row's default `stretch`:
    // pinning the gear to the bottom (`marginTop: "auto"`) only works if the
    // rail actually fills the viewport height.
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
