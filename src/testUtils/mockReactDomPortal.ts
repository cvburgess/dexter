import type { ReactNode } from "react";

// Every web overlay reaches the screen through `components/WebOverlay.web.tsx`,
// which portals into `document.body`. The suite renders through
// react-test-renderer, which has no DOM to portal into and drops the children
// entirely — so a test file covering an overlay stands `createPortal` down to
// rendering its children inline, keeping them in the tree for RNTL queries.
//
// Lives here rather than in each test file because a `jest.mock` factory is
// hoisted above the file's own `const`s and can't close over them:
//
//     jest.mock("react-dom", () => require("@/testUtils/mockReactDomPortal").mockReactDomPortal());
export const mockReactDomPortal = () => ({
  ...jest.requireActual<typeof import("react-dom")>("react-dom"),
  createPortal: (children: ReactNode) => children,
});
