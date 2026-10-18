// The share extension's `dexter://expo-sharing` link is a handoff to expo-sharing,
// not a route (DEX-66) — swallow it or Router renders "Unmatched Route" under the modal.
export function redirectSystemPath({
  path,
}: {
  path: string | null;
  initial: boolean;
}): string | null {
  try {
    if (path?.includes("expo-sharing")) return null;
    return path;
  } catch {
    // A link we can't classify is better handed to the router unchanged.
    return path;
  }
}
