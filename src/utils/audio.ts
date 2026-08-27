import { AudioManager } from "react-native-audio-api";

// Leaves iOS's own audio session alone (silent switch stays silent). Both
// audio hooks import this for the side effect before touching AudioContext.
AudioManager.disableSessionManagement();
