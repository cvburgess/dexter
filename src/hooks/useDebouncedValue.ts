import { useEffect, useState } from "react";

/**
 * `value`, but only after it has stopped changing for `delayMs`.
 *
 * For throttling *work* keyed on a fast-changing input — a server query per
 * keystroke, say. Deliberately not `useDeferredValue`, which is a rendering
 * priority hint rather than a timer: it only skips intermediate values while a
 * low-priority render is still in flight, so when the deferred render is cheap
 * (as it is when the results list is showing a spinner) it commits immediately
 * and every intermediate value gets through anyway.
 *
 * The caller keeps rendering `value` itself for anything that must feel
 * immediate, like the text field's own contents.
 */
export const useDebouncedValue = <T>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};
