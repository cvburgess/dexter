// Exists only so tsc (no platform-extension resolution) can resolve this
// import; the bundler always selects a real .native/.web variant instead.
export * from "./ConfirmationModal.types";
export { ConfirmationModal } from "./ConfirmationModal.native";
