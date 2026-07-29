// Base (native) implementation of the one-button alert; `alert.web.ts` is the
// browser fallback and the bundler selects it on web. This base file also lets
// TypeScript resolve `@/utils/alert` (it does not resolve platform extensions).
import { Alert } from "react-native";

/**
 * Show a one-button alert. The web variant has no title slot, so keep the
 * message self-contained enough to read without the title.
 */
export const showAlert = (title: string, message: string): void => {
  Alert.alert(title, message);
};
