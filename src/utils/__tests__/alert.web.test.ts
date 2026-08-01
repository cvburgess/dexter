// Imported by path so the web variant is exercised regardless of the
// resolver's platform, per docs/testing.md — the alternative is mocking
// `Platform.OS`.
import { showAlert } from "../alert.web";

describe("showAlert (web)", () => {
  // Jest's environment has a `window` but no `alert` on it, so there is nothing
  // to spy on — assign the stub and put the original back afterwards. The
  // reference is only ever stored and re-assigned, never called detached, so
  // `unbound-method` (which flags it as of typescript-eslint 8.65) has nothing
  // to protect here.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalAlert = window.alert;
  const windowAlert = jest.fn();

  beforeEach(() => {
    windowAlert.mockClear();
    window.alert = windowAlert;
  });

  afterEach(() => {
    window.alert = originalAlert;
  });

  it("falls back to the browser dialog, where RN's Alert is a no-op", () => {
    showAlert("Something went wrong", "Please try again.");

    // The browser dialog has no title slot, so only the message survives.
    expect(windowAlert).toHaveBeenCalledWith("Please try again.");
  });
});
