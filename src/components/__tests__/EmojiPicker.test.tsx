import { render } from "@testing-library/react-native";

import { EmojiPicker } from "@/components/EmojiPicker";

// rn-emoji-keyboard's sheet animates its height via Animated.timing (in a mount
// effect that runs even while closed), which schedules timers. Fake timers keep
// those from firing after the test environment tears down.
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe("EmojiPicker", () => {
  it("mounts (closed) without throwing", () => {
    const onClose = jest.fn();
    const onSelect = jest.fn();

    expect(() =>
      render(
        <EmojiPicker open={false} onClose={onClose} onSelect={onSelect} />,
      ),
    ).not.toThrow();
  });
});
