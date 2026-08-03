import { render } from "@testing-library/react-native";
import { useShareIntentContext } from "expo-share-intent";

import { ShareIntentRedirect } from "../ShareIntentRedirect";

const mockPush = jest.fn();
// Reassigned per test, so the factory below reads it lazily rather than
// capturing a value — `undefined` is the pre-mount root navigation state.
let mockNavigationState: { key: string } | undefined = { key: "root" };
jest.mock("expo-router", () => ({
  router: { push: (href: unknown) => mockPush(href) },
  useRootNavigationState: () => mockNavigationState,
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
    mockNavigationState = { key: "root" };
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

  // The cold-start case: a share that launched the app can be delivered before
  // the root navigator exists, and pushing then drops it silently.
  it("waits for the navigator rather than losing a cold-start share", () => {
    mockNavigationState = undefined;
    setShareIntent({ webUrl: "https://example.com", text: null });

    const screen = render(<ShareIntentRedirect />);

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();

    mockNavigationState = { key: "root" };
    screen.rerender(<ShareIntentRedirect />);

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/new-task",
      params: { url: "https://example.com" },
    });
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
