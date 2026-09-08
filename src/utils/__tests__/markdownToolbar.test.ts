import type { StyleState } from "react-native-enriched-markdown";

import {
  headingLabel,
  isListActive,
  nextHeadingLevel,
} from "@/utils/markdownToolbar";

const styleState = (overrides: Partial<StyleState> = {}): StyleState => ({
  bold: { isActive: false },
  italic: { isActive: false },
  underline: { isActive: false },
  strikethrough: { isActive: false },
  spoiler: { isActive: false },
  link: { isActive: false },
  heading: { isActive: false, level: 1 },
  unorderedList: { isActive: false, depth: 0 },
  orderedList: { isActive: false, depth: 0 },
  ...overrides,
});

describe("nextHeadingLevel", () => {
  it("starts at H1 from a paragraph", () => {
    expect(nextHeadingLevel(null)).toBe(1);
    expect(nextHeadingLevel(styleState())).toBe(1);
  });

  it("steps up through the cycle", () => {
    const at = (level: 1 | 2 | 3) =>
      styleState({ heading: { isActive: true, level } });

    expect(nextHeadingLevel(at(1))).toBe(2);
    expect(nextHeadingLevel(at(2))).toBe(3);
  });

  it("repeats the level at the end of the cycle, which toggles it off", () => {
    expect(
      nextHeadingLevel(styleState({ heading: { isActive: true, level: 3 } })),
    ).toBe(3);
  });

  it("clears a pasted level deeper than the cycle instead of stepping down", () => {
    expect(
      nextHeadingLevel(styleState({ heading: { isActive: true, level: 5 } })),
    ).toBe(5);
  });
});

describe("headingLabel", () => {
  it("reads the level while a heading is set", () => {
    expect(
      headingLabel(styleState({ heading: { isActive: true, level: 2 } })),
    ).toBe("H2");
  });

  it("falls back to a bare H", () => {
    expect(headingLabel(null)).toBe("H");
    expect(
      headingLabel(styleState({ heading: { isActive: false, level: 3 } })),
    ).toBe("H");
  });
});

describe("isListActive", () => {
  it("covers both list kinds", () => {
    expect(
      isListActive(styleState({ unorderedList: { isActive: true, depth: 0 } })),
    ).toBe(true);
    expect(
      isListActive(styleState({ orderedList: { isActive: true, depth: 2 } })),
    ).toBe(true);
  });

  it("is false without a state or outside a list", () => {
    expect(isListActive(null)).toBe(false);
    expect(isListActive(styleState())).toBe(false);
  });
});
