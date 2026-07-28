import { render, screen } from "@testing-library/react-native";
import { StyleSheet, type TextStyle } from "react-native";

import { HighlightedExcerpt } from "../HighlightedExcerpt";

// The windowing and term matching are unit-tested in
// utils/__tests__/searchHighlight.test.ts; this covers what the component adds
// on top — that a matched run is actually drawn differently from its
// surroundings, which is the whole point of the search results' excerpts.

// An unmatched run carries no style at all, so `flatten` yields undefined —
// hence the optional chain rather than a non-null assertion.
const fontWeightOf = (text: string): TextStyle["fontWeight"] =>
  StyleSheet.flatten(screen.getByText(text).props.style as TextStyle[])
    ?.fontWeight;

describe("HighlightedExcerpt", () => {
  it("renders the matched term as its own emphasized run", () => {
    render(<HighlightedExcerpt text="remember to buy milk" query="milk" />);

    expect(fontWeightOf("milk")).toBe("600");
    expect(fontWeightOf("remember to buy ")).toBeUndefined();
  });

  it("emphasizes every term of a multi-word query", () => {
    render(
      <HighlightedExcerpt text="milk — remember to buy" query="buy milk" />,
    );

    expect(fontWeightOf("milk")).toBe("600");
    expect(fontWeightOf("buy")).toBe("600");
  });

  it("renders the text unemphasized when nothing matches", () => {
    // Defensive — see buildExcerpt's own note on Postgres/JS case-folding.
    render(<HighlightedExcerpt text="an unrelated response" query="prompt" />);

    expect(fontWeightOf("an unrelated response")).toBeUndefined();
  });

  it("renders nothing for empty text", () => {
    render(<HighlightedExcerpt text="" query="milk" />);

    expect(screen.queryByText("milk")).toBeNull();
  });
});
