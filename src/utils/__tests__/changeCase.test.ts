import { camelCase } from "@/utils/changeCase";

describe("camelCase", () => {
  it("converts nested object keys", () => {
    expect(
      camelCase([
        {
          habit_id: "habit-1",
          habits: {
            days_active: [1, 2],
            is_paused: false,
          },
        },
      ]),
    ).toEqual([
      {
        habitId: "habit-1",
        habits: {
          daysActive: [1, 2],
          isPaused: false,
        },
      },
    ]);
  });
});
