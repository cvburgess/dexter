import AsyncStorage from "@react-native-async-storage/async-storage";

// Stashes the pending authorization_id so an unauthenticated visitor bounced
// to login returns to consent, not Today, after sign-in.
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
