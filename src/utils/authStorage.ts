import AsyncStorage from "@react-native-async-storage/async-storage";

const INVALID_REFRESH_TOKEN_MATCHES = [
  "invalid refresh token",
  "refresh token not found",
  "refresh_token_not_found",
];

export function isInvalidRefreshTokenError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const lowerMessage = message.toLowerCase();
  return INVALID_REFRESH_TOKEN_MATCHES.some((match) =>
    lowerMessage.includes(match),
  );
}

function isAuthStorageKey(key: string): boolean {
  // Never remove the PKCE code verifier — bootstrap can run this mid-exchange,
  // and deleting it would fail the exchange and discard a valid login.
  if (key.endsWith("-code-verifier")) return false;
  return key.startsWith("sb-") || key.includes("supabase");
}

/** Recovers from a corrupted/revoked refresh token that errors every bootstrap. */
export async function clearSupabaseAuthStorage(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const authKeys = keys.filter(isAuthStorageKey);
  await Promise.all(authKeys.map((key) => AsyncStorage.removeItem(key)));
}
