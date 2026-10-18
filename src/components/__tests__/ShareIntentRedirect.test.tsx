import { render } from "@testing-library/react-native";
import { useIncomingShare } from "expo-sharing";

import { ShareIntentRedirect } from "../ShareIntentRedirect";

const mockPush = jest.fn();
// Reassigned per test, so the factory below reads it lazily rather than
// capturing a value — `undefined` is the pre-mount root navigation state.
let mockNavigationState: { key: string } | undefined = { key: "root" };
const mockRouter = { push: (href: unknown) => mockPush(href) };
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useRootNavigationState: () => mockNavigationState,
}));

const mockReset = jest.fn();
const mockRefresh = jest.fn();

/** Stands in for the hook's published state. `expo-sharing` is mocked
 * globally in jest.setup.js; this points its hook at one share. */
const setShareIntent = (share: {
  text: string | null;
  webUrl: string | null;
}) =>
  (useIncomingShare as jest.Mock).mockReturnValue({
    sharedPayloads: [
      ...(share.webUrl ? [{ shareType: "url", value: share.webUrl }] : []),
      ...(share.text ? [{ shareType: "text", value: share.text }] : []),
    ],
    clearSharedPayloads: mockReset,
    refreshSharePayloads: mockRefresh,
  });

describe("ShareIntentRedirect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigationState = { key: "root" };
  });

  it("opens the create-task modal with the shared link", async () => {
    setShareIntent({ webUrl: "https://example.com/post", text: null });

    await render(<ShareIntentRedirect />);

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/new-task",
      params: { url: "https://example.com/post" },
    });
  });

  it("pulls the link out of shared text when there is no web URL", async () => {
    setShareIntent({
      webUrl: null,
      text: "Worth reading https://example.com/a",
    });

    await render(<ShareIntentRedirect />);

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/new-task",
      params: { url: "https://example.com/a" },
    });
  });

  // A share is still a request to make a task, even when nothing in it parses
  // as a link — the modal opens, just without the field filled.
  it("opens an empty modal for a share carrying no link", async () => {
    setShareIntent({ webUrl: null, text: "just a note" });

    await render(<ShareIntentRedirect />);

    expect(mockPush).toHaveBeenCalledWith("/new-task");
  });

  // The hook publishes no payloads whenever no share is pending, which is the
  // state every ordinary launch mounts in.
  it("stays out of the way when no share arrived", async () => {
    setShareIntent({ webUrl: null, text: null });

    await render(<ShareIntentRedirect />);

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
  });

  // The cold-start case: a share that launched the app can be delivered before
  // the root navigator exists, and pushing then drops it silently.
  it("waits for the navigator rather than losing a cold-start share", async () => {
    mockNavigationState = undefined;
    setShareIntent({ webUrl: "https://example.com", text: null });

    const screen = await render(<ShareIntentRedirect />);

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();

    mockNavigationState = { key: "root" };
    await screen.rerender(<ShareIntentRedirect />);

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/new-task",
      params: { url: "https://example.com" },
    });
  });

  // Clearing and refreshing is what empties the payloads, so a re-render
  // can't push a second modal for the same share.
  it("clears the payload so one share opens one modal", async () => {
    setShareIntent({ webUrl: "https://example.com", text: null });

    const screen = await render(<ShareIntentRedirect />);
    setShareIntent({ webUrl: null, text: null });
    await screen.rerender(<ShareIntentRedirect />);

    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledTimes(1);
  });
});
