import { withOpacity } from "../theme";

describe("withOpacity", () => {
  it("applies an alpha channel to a hex color", () => {
    expect(withOpacity("#593d31", 0.25)).toBe("rgba(89, 61, 49, 0.25)");
  });

  it("multiplies the existing alpha when given an rgba color", () => {
    expect(withOpacity("rgba(89, 61, 49, 0.25)", 0.1)).toBe(
      "rgba(89, 61, 49, 0.025)",
    );
  });

  it("treats an rgb color with no alpha as fully opaque before multiplying", () => {
    expect(withOpacity("rgb(89, 61, 49)", 0.5)).toBe("rgba(89, 61, 49, 0.5)");
  });
});
