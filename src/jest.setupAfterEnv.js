// Fail the suite on React's act(...) warning — 45 of them had buried real
// failures (DEX-130). Must be setupFilesAfterEnv: setupFiles has no lifecycle.

const { format } = require("util");

const originalError = console.error;
const actWarnings = [];

// Assignment, not `jest.spyOn` — ~65 test files call restoreAllMocks(),
// which would silently disarm a spy and leave the guard passing vacuously.
console.error = (...args) => {
  if (typeof args[0] === "string" && args[0].includes("not wrapped in act")) {
    // Format first (React passes the component via %s); keep only line one —
    // the rest is boilerplate plus a stack ending in whichever timer flushed.
    actWarnings.push(
      format(...args)
        .split("\n")[0]
        .trim(),
    );
    return;
  }
  originalError(...args);
};

// The warning can fire during a later test than the one that caused it —
// hence both hooks, and the hedge in the message.
const failOnActWarnings = () => {
  if (actWarnings.length === 0) return;

  const count = actWarnings.length;
  const seen = actWarnings.map((warning) => `  - ${warning}`).join("\n");
  actWarnings.length = 0;

  throw new Error(
    `React logged ${count} "not wrapped in act(...)" warning(s):\n${seen}\n\n` +
      "A state update landed outside act(), so whatever this test asserted " +
      "ran against state that hadn't settled. The cause may be an earlier " +
      "test in this file whose async work outlived it: resolve mocked " +
      "promises inside act(), and end the test by awaiting the hook's own " +
      "terminal state rather than a mock's call count. See docs/testing.md.",
  );
};

afterEach(failOnActWarnings);
afterAll(failOnActWarnings);
