import { render } from "@testing-library/react-native";
import { useShareIntentContext } from "expo-share-intent";

import { ShareIntentRedirect } from "../ShareIntentRedirect";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: (href: unknown) => mockPush(href) },
}));

const mockReset = jest.fn();

/** Stands in for the provider's published state. `expo-share-intent` is mocked
 * globally in jest.setup.js; this points its hook at one payload. */
const setShareIntent = (shareIntent: {
  text: string | null;
  webUrl: string | null;
}) =>
  (useShareIntentContext as jest.Mock).mockReturnValue({
    // What the real hook derives: a share has arrived once anything is in it.
    hasShareIntent: Boolean(shareIntent.text ?? shareIntent.webUrl),
    shareIntent,
    resetShareIntent: mockReset,
  });

describe("ShareIntentRedirect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("opens the create-task modal with the shared link", () => {
    setShareIntent({ webUrl: "https://example.com/post", text: null });

    render(<ShareIntentRedirect />);

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/new-task",
      params: { url: "https://example.com/post" },
    });
  });

  it("pulls the link out of shared text when there is no web URL", () => {
    setShareIntent({
      webUrl: null,
      text: "Worth reading https://example.com/a",
    });

    render(<ShareIntentRedirect />);

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/new-task",
      params: { url: "https://example.com/a" },
    });
  });

  // A share is still a request to make a task, even when nothing in it parses
  // as a link — the modal opens, just without the field filled.
  it("opens an empty modal for a share carrying no link", () => {
    setShareIntent({ webUrl: null, text: "just a note" });

    render(<ShareIntentRedirect />);

    expect(mockPush).toHaveBeenCalledWith("/new-task");
  });

  // The provider publishes an empty payload whenever no share is pending, which
  // is the state every ordinary launch mounts in.
  it("stays out of the way when no share arrived", () => {
    setShareIntent({ webUrl: null, text: null });

    render(<ShareIntentRedirect />);

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
  });

  // Clearing the payload is what flips `hasShareIntent` false, so a re-render
  // can't push a second modal for the same share.
  it("clears the payload so one share opens one modal", () => {
    setShareIntent({ webUrl: "https://example.com", text: null });

    const screen = render(<ShareIntentRedirect />);
    setShareIntent({ webUrl: null, text: null });
    screen.rerender(<ShareIntentRedirect />);

    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledTimes(1);
  });
});
