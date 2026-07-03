import { Redirect } from "expo-router";

// TODO(auth): branch on useAuth().session — redirect signed-out users to
// /(auth)/login once the auth routes land.
export default function Index() {
  return <Redirect href="/(app)/(tabs)/today" />;
}
