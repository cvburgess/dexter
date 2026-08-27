// RN's Alert is a no-op on web; fall back to the browser dialog, which has
// no title slot, so `title` is dropped here.
export const showAlert = (_title: string, message: string): void => {
  window.alert(message);
};
