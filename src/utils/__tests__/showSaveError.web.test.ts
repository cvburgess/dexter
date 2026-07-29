// `showSaveError` is platform-agnostic — only the alert underneath it splits —
// so covering the web path means swapping in the web variant of `../alert`.
// Jest resolves the extension-less path to the native file, and the factory is
// hoisted above the imports, hence `requireActual` rather than a plain import.
import { showSaveError } from "../showSaveError";

jest.mock("../alert", () =>
  jest.requireActual<typeof import("../alert.web")>("../alert.web"),
);

describe("showSaveError (web)", () => {
  // Jest's environment has a `window` but no `alert` on it, so there is nothing
  // to spy on — assign the stub and put the original back afterwards.
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

    // The browser dialog has no title slot, so "Something went wrong" is lost —
    // the message has to carry the failure on its own.
    expect(windowAlert).toHaveBeenCalledWith(
      "We couldn't save your task. Please try again.",
    );
  });
});
