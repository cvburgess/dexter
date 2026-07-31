import { type Href, Link, usePathname, useRouter } from "expo-router";
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
import { WEB_NAV_RAIL_WIDTH } from "@/utils/breakpoints";
import { newTaskRoute } from "@/utils/newTaskRoute";
import { Theme, useTheme, withOpacity } from "@/utils/theme";

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
 * The app's web navigation destinations, in rail order (top to bottom) and dock
 * order (left to right). Keep in sync with the native tab triggers in
 * `app/(app)/(tabs)/_layout.tsx` when a tab is added or removed — the two
 * declarations are deliberately separate (different icon vocabularies, and web
 * adds a "+" that native hosts as a tab-bar accessory instead), so nothing
 * enforces it automatically.
 */
export const WEB_NAV_ITEMS: TWebNavItem[] = [
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
const isActive = (pathname: string, href: TWebNavHref) =>
  pathname === href || pathname.startsWith(`${href}/`);

/**
 * Shared behavior for both nav variants: which destination is current, and how
 * to open the create-task modal. Destinations themselves are `Link`s rather than
 * handlers — see `navItemProps`.
 */
function useWebNav() {
  const router = useRouter();
  const pathname = usePathname();
  const largeDevice = useIsLargeDevice();

  // Resolved at press time, not render time — see `newTaskRoute`.
  const openNewTask = () => router.push(newTaskRoute());

  // Filtered here rather than in each variant so the rail and the dock always
  // offer the same destinations.
  const items = WEB_NAV_ITEMS.filter(
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
const navItemProps = (item: TWebNavItem, selected: boolean) => ({
  accessibilityLabel: item.label,
  accessibilityState: { selected },
  "aria-current": selected ? ("page" as const) : undefined,
  testID: `web-nav-${item.key}`,
});

/**
 * The web navigation rail shown on wide viewports (see `(tabs)/_layout.web.tsx`).
 * Ports the legacy dexter-app's `DesktopNav`: a narrow full-height column of
 * floating rounded icon tiles on the sunken background, the active one filled
 * with the inverted ink color, and the gear pinned to the bottom. The "+" below
 * it is Dexter's create-task entry point on web (DEX-74).
 */
export function WebNavRail() {
  const theme = useTheme();
  const { items, openNewTask, pathname } = useWebNav();
  // Legacy parity: a square card a step larger than a standard icon button, so
  // the rail's tiles read as destinations rather than controls. Its glyph is
  // half the tile, which is what keeps the proportion on both density tiers.
  const tile = theme.controls.md + theme.space.sm;
  const glyph = Math.round(tile / 2);

  return (
    <View
      aria-label="Main navigation"
      role="navigation"
      style={[
        styles.rail,
        {
          // Sunken, not `background`: the rail is chrome beside the content
          // pane, and on the same surface the two read as one sheet (DEX-61).
          // The tiles' own `card` fill is what lifts them off it.
          backgroundColor: theme.colors.surfaceSunken,
          gap: theme.space.sm,
          paddingVertical: theme.space.md,
        },
      ]}
    >
      {items.map((item) => {
        const selected = isActive(pathname, item.href);

        return (
          <Link asChild href={item.href} key={item.key}>
            <Pressable
              {...navItemProps(item, selected)}
              // Flattened, not an array: `Link`'s `Slot` clones this child and
              // can't merge an array style with the props it injects.
              style={StyleSheet.flatten([
                styles.tile,
                tileStyle(theme, tile),
                {
                  backgroundColor: selected
                    ? withOpacity(theme.colors.text, 0.8)
                    : theme.colors.card,
                  // Absorbs the rail's leftover height, pushing this item — and
                  // the "+" that follows it — to the bottom.
                  marginTop: item.pinnedToBottom ? "auto" : 0,
                },
              ])}
            >
              <SettingsIcon
                color={selected ? theme.colors.background : theme.colors.text}
                name={item.icon}
                size={glyph}
              />
            </Pressable>
          </Link>
        );
      })}

      <TouchableOpacity
        accessibilityLabel="New Task"
        accessibilityRole="button"
        onPress={openNewTask}
        style={[
          styles.tile,
          tileStyle(theme, tile),
          { backgroundColor: theme.colors.primary },
        ]}
        testID="web-nav-new-task"
      >
        <SettingsIcon
          color={theme.colors.primaryContent}
          name="add"
          size={glyph}
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
  const { items, openNewTask, pathname } = useWebNav();

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
        testID="web-nav-new-task"
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

/** The rail tile's density-dependent box; see `WebNavRail`. */
const tileStyle = (theme: Theme, size: number) => ({
  borderRadius: theme.radii.md,
  boxShadow: `0 1px 3px ${withOpacity(theme.colors.text, 0.12)}`,
  height: size,
  width: size,
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
    width: WEB_NAV_RAIL_WIDTH,
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
