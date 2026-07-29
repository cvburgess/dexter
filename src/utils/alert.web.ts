// Web implementation of the one-button alert. RN's `Alert` is a no-op on web,
// so fall back to the browser's dialog. It has no title slot, so `title` is
// dropped here — the message has to stand on its own.
export const showAlert = (_title: string, message: string): void => {
  window.alert(message);
};
