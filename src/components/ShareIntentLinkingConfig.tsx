import * as Linking from "expo-linking";
import { router } from "expo-router";
import { getShareExtensionKey, ShareIntentModule } from "expo-share-intent";
import { useEffect, useRef } from "react";

/** How long a navigation blocks a second one. See `isNavigating` below. */
const NAVIGATION_COOLDOWN_MS = 2000;

/**
 * A share can arrive while the app is running, backgrounded, or not launched at
 * all, and no single signal covers all three — so this listens on every channel
 * `expo-share-intent` offers and routes each of them to the same screen.
 *
 * Renders nothing; mounted once, at the root. On web every branch is inert:
 * `ShareIntentModule` is undefined there, and the URL listener only fires for
 * Dexter's own deep links, which Expo Router already handles.
 */
export function ShareIntentLinkingConfig() {
  // iOS can deliver overlapping signals for one share — the URL listener and
  // the module's own `onChange` both fire — and two navigations would open two
  // create-task modals for a single shared link.
  const isNavigating = useRef(false);

  useEffect(() => {
    const navigateToShareIntent = () => {
      if (isNavigating.current) return;
      isNavigating.current = true;
      router.replace("/share-intent");
      setTimeout(() => {
        isNavigating.current = false;
      }, NAVIGATION_COOLDOWN_MS);
    };

    // The share extension hands the payload back through a `dexter://` URL
    // carrying the key it stored the payload under, not the payload itself.
    const isShareIntentUrl = (url: string) =>
      url.includes(getShareExtensionKey());

    const onReceiveURL = ({ url }: { url: string }) => {
      if (isShareIntentUrl(url)) navigateToShareIntent();
    };

    // Android, app backgrounded.
    const stateSubscription = ShareIntentModule?.addListener(
      "onStateChange",
      (event) => {
        if (event.value === "pending") navigateToShareIntent();
      },
    );

    // iOS, app already running: the module signals that a payload landed, and
    // the URL it came in on is read back rather than delivered with the event.
    const valueSubscription = ShareIntentModule?.addListener("onChange", () => {
      void Linking.getInitialURL().then((url) => {
        if (url) onReceiveURL({ url });
      });
    });

    // iOS, app backgrounded.
    const urlSubscription = Linking.addEventListener("url", onReceiveURL);

    // Cold start, both platforms: nothing is emitted for a share that launched
    // the app, so the initial URL (iOS) and the module's own pending flag
    // (Android) are checked once instead.
    const checkColdStart = async () => {
      const url = await Linking.getInitialURL();
      if (url && isShareIntentUrl(url)) {
        navigateToShareIntent();
        return;
      }
      if (ShareIntentModule?.hasShareIntent(getShareExtensionKey())) {
        navigateToShareIntent();
      }
    };

    // Deferred a tick: on a cold start this runs before the router has mounted
    // its routes, and navigating into one that isn't registered yet is a no-op.
    const timeoutId = setTimeout(() => void checkColdStart(), 100);

    return () => {
      clearTimeout(timeoutId);
      stateSubscription?.remove();
      valueSubscription?.remove();
      urlSubscription.remove();
    };
  }, []);

  return null;
}
