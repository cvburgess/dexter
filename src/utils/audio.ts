import { AudioManager } from "react-native-audio-api";

// Leaves iOS's own audio session alone, so a phone on silent stays silent and
// nothing the app plays hijacks the hardware's own rules. Must run before any
// context exists — importing this module for its side effect is the
// guarantee, since both audio hooks import it before they touch
// `AudioContext`. A no-op on web, where the session concept does not apply.
AudioManager.disableSessionManagement();
