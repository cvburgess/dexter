import { extractSharedUrl, normalizeTaskUrl } from "../taskUrl";

describe("normalizeTaskUrl", () => {
  it("treats an empty or blank field as no link", () => {
    expect(normalizeTaskUrl("")).toBeNull();
    expect(normalizeTaskUrl("   ")).toBeNull();
  });

  it("trims the surrounding whitespace a paste brings with it", () => {
    expect(normalizeTaskUrl("  https://example.com  ")).toBe(
      "https://example.com",
    );
  });

  it("leaves a link that already has a scheme alone", () => {
    expect(normalizeTaskUrl("https://example.com/a?b=c#d")).toBe(
      "https://example.com/a?b=c#d",
    );
    expect(normalizeTaskUrl("http://example.com")).toBe("http://example.com");
  });

  // The whole point of prepending rather than rejecting: `Linking.openURL`
  // won't open a scheme-less value at all, so a bare host has to be completed.
  it("prepends https:// to a bare host", () => {
    expect(normalizeTaskUrl("dexterplanner.com")).toBe(
      "https://dexterplanner.com",
    );
    expect(normalizeTaskUrl("example.com/path")).toBe(
      "https://example.com/path",
    );
  });

  // Schemes other than http(s) are links too, and completing them would break
  // them.
  it("leaves a non-web scheme intact", () => {
    expect(normalizeTaskUrl("mailto:hi@example.com")).toBe(
      "mailto:hi@example.com",
    );
    expect(normalizeTaskUrl("dexter://today")).toBe("dexter://today");
  });

  // `host:port` looks like a scheme to a naive match, and left alone it would
  // never open.
  it("prepends https:// to a bare host carrying a port", () => {
    expect(normalizeTaskUrl("localhost:3000")).toBe("https://localhost:3000");
    expect(normalizeTaskUrl("example.com:8080/admin")).toBe(
      "https://example.com:8080/admin",
    );
  });

  it("never rejects, so a typo can't block saving the task", () => {
    expect(normalizeTaskUrl("not a url")).toBe("https://not a url");
  });
});

describe("extractSharedUrl", () => {
  it("prefers the payload's own web URL", () => {
    expect(
      extractSharedUrl(
        "https://example.com/page",
        "Some page https://other.com",
      ),
    ).toBe("https://example.com/page");
  });

  // Share sheets that send text often send the page title with the link
  // appended, so the whole string is not the URL.
  it("pulls the first link out of shared text", () => {
    expect(
      extractSharedUrl(null, "Read this: https://example.com/post and reply"),
    ).toBe("https://example.com/post");
  });

  it("has no link when the payload carries none", () => {
    expect(extractSharedUrl(null, "just a note")).toBeNull();
    expect(extractSharedUrl(null, null)).toBeNull();
    expect(extractSharedUrl()).toBeNull();
  });

  // The empty-first-emission payload: present, but with nothing in it yet.
  it("ignores a blank web URL and falls through to the text", () => {
    expect(extractSharedUrl("   ", "https://example.com")).toBe(
      "https://example.com",
    );
  });
});
