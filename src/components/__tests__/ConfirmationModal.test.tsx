import { fireEvent, render } from "@testing-library/react-native";
import { Alert } from "react-native";

import { ConfirmationModal as ConfirmationModalNative } from "../ConfirmationModal.native";
import { ConfirmationModal as ConfirmationModalWeb } from "../ConfirmationModal.web";
import { WebOverlay } from "../WebOverlay.web";

// WebOverlay portals to document.body at runtime; render inline so
// react-test-renderer keeps it in the tree for RNTL queries.
jest.mock("react-dom", () =>
  require("@/testUtils/mockReactDomPortal").mockReactDomPortal(),
);

type AlertButton = {
  text: string;
  style?: string;
  onPress?: () => void | Promise<void>;
};

describe("ConfirmationModal", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("web", () => {
    test("renders title, message, and confirm/cancel buttons", async () => {
      const { getByText } = await render(
        <ConfirmationModalWeb
          visible
          title="Delete task"
          message="Are you sure?"
          confirmLabel="Delete"
          onClose={jest.fn()}
          onConfirm={jest.fn()}
        />,
      );

      expect(getByText("Delete task")).toBeTruthy();
      expect(getByText("Are you sure?")).toBeTruthy();
      expect(getByText("Delete")).toBeTruthy();
      expect(getByText("Cancel")).toBeTruthy();
    });

    // In-tree used to leave it dead under an open drawer, inheriting the
    // body's `pointer-events: none` (DEX-134).
    test("renders through WebOverlay only while visible", async () => {
      const props = {
        title: "Delete task",
        message: "Are you sure?",
        onClose: jest.fn(),
        onConfirm: jest.fn(),
      };
      const { UNSAFE_root, rerender } = await render(
        <ConfirmationModalWeb visible={false} {...props} />,
      );

      expect(UNSAFE_root.findAllByType(WebOverlay)).toHaveLength(0);

      await rerender(<ConfirmationModalWeb visible {...props} />);

      expect(UNSAFE_root.findAllByType(WebOverlay)).toHaveLength(1);
    });

    test("confirm button fires onConfirm then onClose", async () => {
      const onConfirm = jest.fn();
      const onClose = jest.fn();
      const { getByText } = await render(
        <ConfirmationModalWeb
          visible
          title="T"
          message="M"
          confirmLabel="Delete"
          onClose={onClose}
          onConfirm={onConfirm}
        />,
      );

      await fireEvent.press(getByText("Delete"));

      expect(onConfirm).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    test("cancel button fires onClose only", async () => {
      const onConfirm = jest.fn();
      const onClose = jest.fn();
      const { getByText } = await render(
        <ConfirmationModalWeb
          visible
          title="T"
          message="M"
          onClose={onClose}
          onConfirm={onConfirm}
        />,
      );

      await fireEvent.press(getByText("Cancel"));

      expect(onConfirm).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    test("renders custom actions and wires their onPress", async () => {
      const keep = jest.fn();
      const onClose = jest.fn();
      const { getByText } = await render(
        <ConfirmationModalWeb
          visible
          title="Repeating task"
          message="Delete this occurrence?"
          onClose={onClose}
          actions={[
            { label: "Cancel", role: "cancel" },
            { label: "Keep repeat", onPress: keep },
            { label: "Delete", role: "destructive" },
          ]}
        />,
      );

      expect(getByText("Keep repeat")).toBeTruthy();
      await fireEvent.press(getByText("Keep repeat"));
      expect(keep).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("native", () => {
    test("presents Alert.alert with title, message, and synthesized buttons", async () => {
      const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

      await render(
        <ConfirmationModalNative
          visible
          title="Delete task"
          message="Sure?"
          confirmLabel="Delete"
          destructive
          onClose={jest.fn()}
          onConfirm={jest.fn()}
        />,
      );

      expect(alertSpy).toHaveBeenCalledWith(
        "Delete task",
        "Sure?",
        [
          expect.objectContaining({ text: "Cancel", style: "cancel" }),
          expect.objectContaining({ text: "Delete", style: "destructive" }),
        ],
        // onDismiss presence/behavior is covered by the dedicated dismiss test.
        expect.objectContaining({}),
      );
    });

    test("does not present when not visible", async () => {
      const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

      await render(
        <ConfirmationModalNative
          visible={false}
          title="T"
          message="M"
          onClose={jest.fn()}
          onConfirm={jest.fn()}
        />,
      );

      expect(alertSpy).not.toHaveBeenCalled();
    });

    test("presents once per visible -> true transition", async () => {
      const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

      const props = {
        title: "T",
        message: "M",
        onClose: jest.fn(),
        onConfirm: jest.fn(),
      };
      const { rerender } = await render(
        <ConfirmationModalNative visible={false} {...props} />,
      );
      expect(alertSpy).not.toHaveBeenCalled();

      await rerender(<ConfirmationModalNative visible {...props} />);
      expect(alertSpy).toHaveBeenCalledTimes(1);

      await rerender(<ConfirmationModalNative visible {...props} />);
      expect(alertSpy).toHaveBeenCalledTimes(1);

      await rerender(<ConfirmationModalNative visible={false} {...props} />);
      await rerender(<ConfirmationModalNative visible {...props} />);
      expect(alertSpy).toHaveBeenCalledTimes(2);
    });

    test("confirm button fires onConfirm and onClose", async () => {
      const onConfirm = jest.fn();
      const onClose = jest.fn();
      const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

      await render(
        <ConfirmationModalNative
          visible
          title="T"
          message="M"
          confirmLabel="Delete"
          onClose={onClose}
          onConfirm={onConfirm}
        />,
      );

      const buttons = alertSpy.mock.calls[0][2] as AlertButton[];
      void buttons.find((b) => b.text === "Delete")?.onPress?.();

      expect(onConfirm).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    test("cancel button fires onClose without onConfirm", async () => {
      const onConfirm = jest.fn();
      const onClose = jest.fn();
      const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

      await render(
        <ConfirmationModalNative
          visible
          title="T"
          message="M"
          onClose={onClose}
          onConfirm={onConfirm}
        />,
      );

      const buttons = alertSpy.mock.calls[0][2] as AlertButton[];
      void buttons.find((b) => b.text === "Cancel")?.onPress?.();

      expect(onConfirm).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    test("supports 3-button custom action sets", async () => {
      const keep = jest.fn();
      const onClose = jest.fn();
      const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

      await render(
        <ConfirmationModalNative
          visible
          title="Repeating task"
          message="Delete this occurrence?"
          onClose={onClose}
          actions={[
            { label: "Cancel", role: "cancel" },
            { label: "Keep repeat", onPress: keep },
            { label: "Delete", role: "destructive" },
          ]}
        />,
      );

      expect(alertSpy).toHaveBeenCalledWith(
        "Repeating task",
        "Delete this occurrence?",
        [
          expect.objectContaining({ text: "Cancel", style: "cancel" }),
          expect.objectContaining({ text: "Keep repeat" }),
          expect.objectContaining({
            text: "Delete",
            style: "destructive",
          }),
        ],
        // onDismiss presence/behavior is covered by the dedicated dismiss test.
        expect.objectContaining({}),
      );

      const buttons = alertSpy.mock.calls[0][2] as AlertButton[];
      void buttons.find((b) => b.text === "Keep repeat")?.onPress?.();
      expect(keep).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    test("dismiss (onDismiss) calls onClose", async () => {
      const onClose = jest.fn();
      const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

      await render(
        <ConfirmationModalNative
          visible
          title="T"
          message="M"
          onClose={onClose}
          onConfirm={jest.fn()}
        />,
      );

      const options = alertSpy.mock.calls[0][3] as { onDismiss?: () => void };
      options.onDismiss?.();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
