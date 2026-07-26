import { Temporal } from "@js-temporal/polyfill";

import {
  dateToPlainDate,
  dateToPlainDateISO,
  plainDateISOToDate,
  plainDateToDate,
} from "../plainDate";

describe("plainDateToDate", () => {
  it("builds a local-midnight Date on the same calendar day", () => {
    const date = plainDateToDate(Temporal.PlainDate.from("2026-07-26"));

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(6); // zero-based
    expect(date.getDate()).toBe(26);
    expect(date.getHours()).toBe(0);
  });
});

describe("dateToPlainDate", () => {
  it("reads the Date's local calendar fields", () => {
    const plainDate = dateToPlainDate(new Date(2026, 0, 31, 23, 59));

    expect(plainDate.toString()).toBe("2026-01-31");
  });
});

describe("plainDateISOToDate", () => {
  it("keeps the day west of Greenwich, unlike parsing the ISO string", () => {
    const date = plainDateISOToDate("2026-07-26");

    expect(date.getDate()).toBe(26);
    expect(date.getHours()).toBe(0);
  });
});

describe("dateToPlainDateISO", () => {
  it("returns the local calendar day as YYYY-MM-DD", () => {
    expect(dateToPlainDateISO(new Date(2026, 11, 1, 12, 30))).toBe(
      "2026-12-01",
    );
  });

  it("round-trips an ISO date through a Date unchanged", () => {
    const iso = "2027-02-28";

    expect(dateToPlainDateISO(plainDateISOToDate(iso))).toBe(iso);
  });
});
