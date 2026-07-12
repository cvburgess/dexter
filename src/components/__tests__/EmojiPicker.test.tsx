import { render } from "@testing-library/react-native";

import { EmojiPicker } from "@/components/EmojiPicker";

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
