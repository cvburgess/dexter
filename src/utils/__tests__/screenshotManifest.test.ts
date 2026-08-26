import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseRitualMode, parseRitualStep } from "@/utils/ritualRoute";
import { parseDayMode } from "@/utils/todayRoute";

/**
 * `scripts/screenshots/screens.tsv` names screens by deep link, and nothing at
 * runtime tells you when one stops resolving — the capture just hangs on its
 * anchor until the timeout, months later, the morning of a submission.
 *
 * That is not hypothetical: the procedure this manifest replaced reached the
 * journal through the Today tab's view switcher, DEX-105 moved the journal to
 * the Ritual tab, and the instructions went on saying otherwise until someone
 * tried to use them. This test is the guard that failure earned — it holds the
 * manifest against the same route parsers the app itself uses, so the next such
 * move breaks here instead of there.
 */

type TRow = {
  device: string;
  index: string;
  name: string;
  link: string;
  anchorBy: string;
  anchor: string;
};

const MANIFEST = join(__dirname, "../../../scripts/screenshots/screens.tsv");

const rows: TRow[] = readFileSync(MANIFEST, "utf8")
  .split("\n")
  .filter((line) => line.trim() !== "" && !line.startsWith("#"))
  .map((line) => {
    const [device, index, name, link, anchorBy, anchor] = line.split("\t");
    return { device, index, name, link, anchorBy, anchor };
  });

/** The routes a manifest link may point at, and how to validate each one. */
const ROUTES: Record<string, (params: URLSearchParams) => void> = {
  today: (params) => {
    // A link with neither date nor mode parses to a null TDayLink and reads as
    // an ordinary tab press, which would leave the previous shot's drawer open.
    expect(parseDayMode(params.get("mode") ?? undefined)).not.toBeNull();
  },
  ritual: (params) => {
    expect(parseRitualStep(params.get("step") ?? undefined)).not.toBeNull();
    // Pinning the mode is what makes a ritual capture reproducible at any hour:
    // `horoscope` exists only in the morning, and `journal` renders a different
    // flow either side of noon. Without it the run's output depends on when it
    // happened to be started.
    expect(parseRitualMode(params.get("mode") ?? undefined)).not.toBeNull();
  },
  week: () => {},
  "new-task": () => {},
};

describe("screenshot manifest", () => {
  it("has rows", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it.each(rows)(
    "$device $index-$name is a well-formed row",
    ({ device, index, name, anchorBy, anchor }) => {
      expect(device).toMatch(/^(iphone|ipad)$/);
      expect(index).toMatch(/^\d{2}$/);
      expect(name).toMatch(/^[a-z0-9-]+$/);
      expect(anchorBy).toMatch(/^(id|text)$/);
      expect(anchor?.trim()).toBeTruthy();
    },
  );

  it.each(rows)("$device $index-$name links at a real route", ({ link }) => {
    const url = new URL(link);
    expect(url.protocol).toBe("dexter:");

    const route = url.hostname || url.pathname.replace(/^\/+/, "");
    expect(Object.keys(ROUTES)).toContain(route);

    ROUTES[route](url.searchParams);
  });

  it("gives every Today link a distinct nonce", () => {
    // Cross-tab navigation reuses the mounted screen and only swaps params, so
    // two links with identical values are indistinguishable to it — a repeated
    // nonce silently means "no navigation happened" rather than an error.
    const nonces = rows
      .filter((row) => new URL(row.link).hostname === "today")
      .map((row) => `${row.device}:${new URL(row.link).searchParams.get("n")}`);

    expect(new Set(nonces).size).toBe(nonces.length);
  });

  it("keeps text anchors free of regex metacharacters", () => {
    // Maestro compiles a text selector to a regex: `+ New Task` becomes
    // `textRegex=+ New Task`, a dangling quantifier that can never match.
    const offenders = rows
      .filter((row) => row.anchorBy === "text")
      .filter((row) => /[+()?.*[\]\\^$|{}]/.test(row.anchor))
      .map((row) => `${row.index}-${row.name}: ${row.anchor}`);

    expect(offenders).toEqual([]);
  });

  it("names each output file once per device", () => {
    const files = rows.map((row) => `${row.device}/${row.index}-${row.name}`);
    expect(new Set(files).size).toBe(files.length);
  });
});
