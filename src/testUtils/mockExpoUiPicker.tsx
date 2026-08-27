import { Children, isValidElement, ReactNode } from "react";

// Overrides the global @expo/ui null mock for tests that drive a Picker.
// Props live here since a jest.mock factory is hoisted above its own consts.

let lastProps: Record<string, unknown> | null = null;
const propsByTestID = new Map<string, Record<string, unknown>>();

/** Use as the `jest.mock("@expo/ui", …)` factory. */
export const mockExpoUiPicker = () => {
  const Host = ({ children }: { children: ReactNode }) => children;
  const Picker = (props: Record<string, unknown>) => {
    lastProps = props;
    if (typeof props.testID === "string") {
      propsByTestID.set(props.testID, props);
    }
    return null;
  };
  Picker.Item = function PickerItem() {
    return null;
  };
  return { Host, Picker };
};

/** Props the most recently rendered Picker received — ambiguous with more
 * than one on screen; use {@link pickerPropsFor} then. */
export const pickerProps = () => lastProps;

/** Props the Picker carrying `testID` received. */
export const pickerPropsFor = (testID: string) =>
  propsByTestID.get(testID) ?? null;

const optionsOf = (props: Record<string, unknown> | null) =>
  Children.toArray(props?.children as ReactNode)
    .filter(isValidElement)
    .map((child) => child.props as { label: string; value: string });

/** The `{ label, value }` of each `Picker.Item`, in render order. */
export const pickerOptions = (): { label: string; value: string }[] =>
  optionsOf(lastProps);

/** The `{ label, value }` of each `Picker.Item` under the Picker with `testID`. */
export const pickerOptionsFor = (
  testID: string,
): { label: string; value: string }[] => optionsOf(pickerPropsFor(testID));

/** Call from `beforeEach` so one test can't read another's picker. */
export const resetPicker = () => {
  lastProps = null;
  propsByTestID.clear();
};
