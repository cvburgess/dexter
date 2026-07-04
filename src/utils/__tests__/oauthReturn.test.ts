import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  consumePendingOAuthAuthorizationId,
  setPendingOAuthAuthorizationId,
} from "../oauthReturn";

describe("oauthReturn", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("round-trips a pending authorization id", async () => {
    await setPendingOAuthAuthorizationId("auth-123");
    expect(await consumePendingOAuthAuthorizationId()).toBe("auth-123");
  });

  it("consumes the id once, so a later sign-in is not hijacked", async () => {
    await setPendingOAuthAuthorizationId("auth-123");

    expect(await consumePendingOAuthAuthorizationId()).toBe("auth-123");
    expect(await consumePendingOAuthAuthorizationId()).toBeNull();
  });

  it("returns null when nothing is pending", async () => {
    expect(await consumePendingOAuthAuthorizationId()).toBeNull();
  });
});
