import { Children, isValidElement, ReactNode } from "react";

// The global `@expo/ui` mock in jest.setup.js renders Picker as null, which is
// enough for screens that merely contain one but leaves nothing to assert on or
// drive. Tests that exercise a picker override it with this capturing version
// instead. The captured props live here rather than in the test file because a
// `jest.mock` factory is hoisted above the test file's own `const`s and so
// can't close over them.

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

/**
 * Props the most recently rendered Picker received.
 *
 * Only unambiguous on a screen with exactly one picker — Settings → Tasks now
 * renders two (alarm sound and focus block length), so reach for
 * {@link pickerPropsFor} there.
 */
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
