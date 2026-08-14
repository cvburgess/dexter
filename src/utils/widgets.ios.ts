// iOS implementation of the widget layer: hands the snapshot to the App Group
// the widget extension reads, then asks WidgetKit to redraw (DEX-83). The
// bundler selects this file over `widgets.ts` on iOS.
//
// `ExtensionStorage` ships with `@bacons/apple-targets` — the same package that
// already generates `targets/DexterAlarmWidget` — so this needs no new native
// module. It writes into the group's `UserDefaults`, which is exactly what
// `UserDefaults(suiteName:)` reads back in Swift.
import { ExtensionStorage } from "@bacons/apple-targets";

import { APP_GROUP } from "@/utils/appGroup";

import { TWidgetSnapshot, WIDGET_SNAPSHOT_KEY } from "./widgets.shared";

export * from "./widgets.shared";

const storage = new ExtensionStorage(APP_GROUP);

/**
 * Stored as one JSON string rather than through `ExtensionStorage`'s object and
 * array overloads: those flatten to `Record<string, string | number>`, which
 * cannot express a day holding a list of tasks. A string round-trips through
 * `JSONDecoder` on the other side with the nesting intact, and the payload is
 * camelCase on both sides so no key strategy is needed.
 */
export const writeWidgetSnapshot = (snapshot: TWidgetSnapshot): void => {
  storage.set(WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot));
  ExtensionStorage.reloadWidget();
};

/**
 * Drops the snapshot and redraws — what a sign-out calls, so the next user's
 * home screen isn't still showing the last one's tasks. The widget's own empty
 * state covers the gap.
 */
export const clearWidgetSnapshot = (): void => {
  storage.remove(WIDGET_SNAPSHOT_KEY);
  ExtensionStorage.reloadWidget();
};
