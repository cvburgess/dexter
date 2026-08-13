// Fails the suite on React's "not wrapped in act(...)" warning instead of
// letting it print. The suite had accumulated 45 of them (DEX-130), which is
// enough to bury the one console line a genuinely failing test prints — and
// each one is a real state update landing after its test returned, so the
// assertion that followed it never saw the state it claimed to test.
//
// This has to live in `setupFilesAfterEnv`, not `setupFiles`: the latter runs
// before the test framework is installed, so it cannot register lifecycle
// hooks.

// Replaced by assignment rather than `jest.spyOn`, because ~65 test files call
// `jest.restoreAllMocks()`/`resetAllMocks()` in a hook, any of which would
// silently disarm a spy and leave the guard passing for the wrong reason.
const { format } = require("util");

const originalError = console.error;
const actWarnings = [];

console.error = (...args) => {
  if (typeof args[0] === "string" && args[0].includes("not wrapped in act")) {
    // React passes the component name as a `%s` argument, so the message has
    // to be formatted before it says anything useful. Keep only the first
    // line — the rest is React's boilerplate advice plus a stack that bottoms
    // out in whichever timer flushed the update.
    actWarnings.push(
      format(...args)
        .split("\n")[0]
        .trim(),
    );
    return;
  }
  originalError(...args);
};

// React emits the warning from the timer callback that scheduled the update,
// which can run during a *later* test than the one that caused it — hence
// both hooks, and hence the hedge in the message.
const failOnActWarnings = () => {
  if (actWarnings.length === 0) return;

  const seen = actWarnings.map((warning) => `  - ${warning}`).join("\n");
  actWarnings.length = 0;

  throw new Error(
    `React logged ${seen.split("\n").length} "not wrapped in act(...)" warning(s):\n${seen}\n\n` +
      "A state update landed outside act(), so whatever this test asserted " +
      "ran against state that hadn't settled. The cause may be an earlier " +
      "test in this file whose async work outlived it: resolve mocked " +
      "promises inside act(), and end the test by awaiting the hook's own " +
      "terminal state rather than a mock's call count. See docs/testing.md.",
  );
};

afterEach(failOnActWarnings);
afterAll(failOnActWarnings);
