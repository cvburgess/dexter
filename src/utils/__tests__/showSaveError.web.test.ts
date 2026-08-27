// Only the alert underneath splits by platform; jest resolves extension-less
// paths to native and hoists the factory, hence `requireActual`.
import { showSaveError } from "../showSaveError";

jest.mock("../alert", () =>
  jest.requireActual<typeof import("../alert.web")>("../alert.web"),
);

describe("showSaveError (web)", () => {
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

  it("reaches the browser dialog with the whole sentence", () => {
    showSaveError("task");

    // No title slot, so "Something went wrong" is lost — the message alone
    // must carry the failure.
    expect(windowAlert).toHaveBeenCalledWith(
      "We couldn't save your task. Please try again.",
    );
  });
});
