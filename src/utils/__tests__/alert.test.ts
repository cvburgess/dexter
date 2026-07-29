import { Alert } from "react-native";

import { showAlert } from "../alert";
// Imported by path so the web variant is exercised regardless of the resolver's
// platform, per docs/testing.md — the alternative is mocking `Platform.OS`.
import { showAlert as showWebAlert } from "../alert.web";

describe("showAlert (native)", () => {
  it("shows a titled alert", () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

    showAlert("Something went wrong", "Please try again.");

    expect(alertSpy).toHaveBeenCalledWith(
      "Something went wrong",
      "Please try again.",
    );

    alertSpy.mockRestore();
  });
});

describe("showAlert (web)", () => {
  // Jest's test environment has a `window` but no `alert` on it, so there is
  // nothing to spy on — assign the stub and put the original back afterwards.
  const originalAlert = window.alert;
  const windowAlert = jest.fn();

  beforeEach(() => {
    windowAlert.mockClear();
    window.alert = windowAlert;
  });

  afterEach(() => {
    window.alert = originalAlert;
  });

  it("falls back to the browser dialog, which RN's Alert never reaches", () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

    showWebAlert("Something went wrong", "Please try again.");

    // The browser dialog has no title slot, so only the message survives.
    expect(windowAlert).toHaveBeenCalledWith("Please try again.");
    expect(alertSpy).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });
});
