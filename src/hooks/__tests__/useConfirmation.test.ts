import { act, renderHook } from "@testing-library/react-native";

import { useConfirmation } from "../useConfirmation";

describe("useConfirmation", () => {
  test("resolves true when the confirm action is pressed", async () => {
    const { result } = renderHook(() => useConfirmation());

    let resolved: boolean | undefined;
    act(() => {
      void result.current
        .confirm({ title: "Delete", message: "Sure?", confirmLabel: "Yes" })
        .then((value) => {
          resolved = value;
        });
    });

    expect(result.current.confirmationProps.visible).toBe(true);
    const confirmAction = result.current.confirmationProps.actions?.find(
      (action) => action.label === "Yes",
    );

    // The component fires the action's onPress, then onClose to dismiss.
    await act(async () => {
      await confirmAction?.onPress?.();
      result.current.confirmationProps.onClose();
    });

    expect(resolved).toBe(true);
    expect(result.current.confirmationProps.visible).toBe(false);
  });

  test("resolves false when the cancel action is pressed", async () => {
    const { result } = renderHook(() => useConfirmation());

    let resolved: boolean | undefined;
    act(() => {
      void result.current
        .confirm({ title: "Delete", message: "Sure?" })
        .then((value) => {
          resolved = value;
        });
    });

    const cancelAction = result.current.confirmationProps.actions?.find(
      (action) => action.role === "cancel",
    );

    await act(async () => {
      await cancelAction?.onPress?.();
    });

    expect(resolved).toBe(false);
  });

  test("resolves false on dismiss via onClose", async () => {
    const { result } = renderHook(() => useConfirmation());

    let resolved: boolean | undefined;
    act(() => {
      void result.current
        .confirm({ title: "Delete", message: "Sure?" })
        .then((value) => {
          resolved = value;
        });
    });

    await act(async () => {
      result.current.confirmationProps.onClose();
      await Promise.resolve();
    });

    expect(resolved).toBe(false);
    expect(result.current.confirmationProps.visible).toBe(false);
  });

  test("synthesizes default cancel/confirm labels", () => {
    const { result } = renderHook(() => useConfirmation());

    act(() => {
      void result.current.confirm({ title: "T", message: "M" });
    });

    const labels = result.current.confirmationProps.actions?.map(
      (action) => action.label,
    );
    expect(labels).toEqual(["Cancel", "OK"]);
  });

  test("applies destructive role to the confirm action", () => {
    const { result } = renderHook(() => useConfirmation());

    act(() => {
      void result.current.confirm({
        title: "T",
        message: "M",
        confirmLabel: "Delete",
        destructive: true,
      });
    });

    const confirmAction = result.current.confirmationProps.actions?.find(
      (action) => action.label === "Delete",
    );
    expect(confirmAction?.role).toBe("destructive");
  });

  test("runs custom action onPress and resolves by role", async () => {
    const { result } = renderHook(() => useConfirmation());
    const keepPress = jest.fn();

    let resolved: boolean | undefined;
    act(() => {
      void result.current
        .confirm({
          title: "Repeating task",
          message: "Delete this occurrence?",
          actions: [
            { label: "Cancel", role: "cancel" },
            { label: "Keep repeat", onPress: keepPress },
            { label: "Delete", role: "destructive" },
          ],
        })
        .then((value) => {
          resolved = value;
        });
    });

    const keepAction = result.current.confirmationProps.actions?.find(
      (action) => action.label === "Keep repeat",
    );

    await act(async () => {
      await keepAction?.onPress?.();
    });

    expect(keepPress).toHaveBeenCalled();
    // Non-cancel role resolves true.
    expect(resolved).toBe(true);
  });
});
