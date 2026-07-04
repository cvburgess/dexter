import AsyncStorage from "@react-native-async-storage/async-storage";

// The OAuth consent screen (src/app/oauth/consent.tsx) lives outside the
// authenticated route group, so an unauthenticated visitor is bounced to the
// login screen. We stash the pending `authorization_id` here so the post-login
// redirect (src/app/auth-callback.tsx) can return them to the consent screen
// instead of dropping them on Today. AsyncStorage maps to localStorage on web,
// so the value survives the full-page magic-link / Google redirects.
const PENDING_OAUTH_AUTHORIZATION_ID_KEY =
  "dexter-pending-oauth-authorization-id";

export async function setPendingOAuthAuthorizationId(
  authorizationId: string,
): Promise<void> {
  await AsyncStorage.setItem(
    PENDING_OAUTH_AUTHORIZATION_ID_KEY,
    authorizationId,
  );
}

/**
 * Read and clear the pending authorization id. Consume-once semantics keep a
 * stale id from hijacking a later, unrelated sign-in.
 */
export async function consumePendingOAuthAuthorizationId(): Promise<
  string | null
> {
  const authorizationId = await AsyncStorage.getItem(
    PENDING_OAUTH_AUTHORIZATION_ID_KEY,
  );
  if (authorizationId) {
    await AsyncStorage.removeItem(PENDING_OAUTH_AUTHORIZATION_ID_KEY);
  }
  return authorizationId;
}
