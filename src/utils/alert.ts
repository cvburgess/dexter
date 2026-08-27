// Native impl; alert.web.ts is the browser fallback and also lets tsc
// resolve `@/utils/alert` (it can't resolve platform extensions).
import { Alert } from "react-native";

/** Web has no title slot — keep the message self-contained without one. */
export const showAlert = (title: string, message: string): void => {
  Alert.alert(title, message);
};
