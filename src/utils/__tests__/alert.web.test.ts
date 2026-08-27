// Imported by path so the web variant runs regardless of the resolver's
// platform (docs/testing.md).
import { showAlert } from "../alert.web";

describe("showAlert (web)", () => {
  // Jest's window has no `alert` to spy on, so assign a stub and restore it.
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
