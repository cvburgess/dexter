import { fireEvent, render } from "@testing-library/react-native";

import { useModalHeaderActions } from "../useModalHeaderActions";

const mockNavigation = { setOptions: jest.fn() };
jest.mock("expo-router", () => ({
  useNavigation: () => mockNavigation,
}));

const headerOptions = () => mockNavigation.setOptions.mock.calls.at(-1)?.[0];

function Harness({
  title,
  canSave,
  onClose,
  onSave,
}: {
  title?: string;
  canSave: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  useModalHeaderActions({ title, canSave, onClose, onSave });
  return null;
}

describe("useModalHeaderActions", () => {
  beforeEach(() => {
    mockNavigation.setOptions.mockClear();
  });

  it("includes the title when provided", async () => {
    await render(
      <Harness
        title="Edit Habit"
        canSave
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    expect(headerOptions().title).toBe("Edit Habit");
  });

  it("omits the title key when not provided", async () => {
    await render(<Harness canSave onClose={jest.fn()} onSave={jest.fn()} />);

    expect(headerOptions()).not.toHaveProperty("title");
  });

  it("disables the header items when canSave is false, and re-enables on re-render", async () => {
    const { rerender } = await render(
      <Harness canSave={false} onClose={jest.fn()} onSave={jest.fn()} />,
    );
    expect(headerOptions().unstable_headerRightItems()[0].disabled).toBe(true);

    await rerender(<Harness canSave onClose={jest.fn()} onSave={jest.fn()} />);
    expect(headerOptions().unstable_headerRightItems()[0].disabled).toBe(false);
  });

  it("wires headerLeft/headerRight to onClose/onSave", async () => {
    const onClose = jest.fn();
    const onSave = jest.fn();
    await render(<Harness canSave onClose={onClose} onSave={onSave} />);

    const close = await render(headerOptions().headerLeft());
    await fireEvent.press(close.getByTestId("modal-close-button"));
    expect(onClose).toHaveBeenCalledTimes(1);

    const save = await render(headerOptions().headerRight());
    await fireEvent.press(save.getByTestId("modal-done-button"));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("wires the unstable header items to onClose/onSave", async () => {
    const onClose = jest.fn();
    const onSave = jest.fn();
    await render(<Harness canSave onClose={onClose} onSave={onSave} />);

    headerOptions().unstable_headerLeftItems()[0].onPress();
    headerOptions().unstable_headerRightItems()[0].onPress();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("re-wires to the latest closures on every render (no dependency array)", async () => {
    const firstOnSave = jest.fn();
    const secondOnSave = jest.fn();
    const { rerender } = await render(
      <Harness canSave onClose={jest.fn()} onSave={firstOnSave} />,
    );

    await rerender(
      <Harness canSave onClose={jest.fn()} onSave={secondOnSave} />,
    );

    const save = await render(headerOptions().headerRight());
    await fireEvent.press(save.getByTestId("modal-done-button"));

    expect(firstOnSave).not.toHaveBeenCalled();
    expect(secondOnSave).toHaveBeenCalledTimes(1);
  });
});
