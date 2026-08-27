import { useEffect, useState } from "react";

// Deliberately not useDeferredValue, which is a rendering-priority hint, not
// a timer — a cheap deferred render lets every intermediate value through.
export const useDebouncedValue = <T>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};
