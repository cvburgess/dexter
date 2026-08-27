import type { ReactNode } from "react";

// react-test-renderer has no DOM to portal into and drops portaled children
// entirely; stands `createPortal` down to rendering inline for RNTL queries.
export const mockReactDomPortal = () => ({
  ...jest.requireActual<typeof import("react-dom")>("react-dom"),
  createPortal: (children: ReactNode) => children,
});
