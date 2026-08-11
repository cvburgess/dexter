import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { useRouter } from "expo-router";

import { CongratsStep } from "../CongratsStep";

jest.mock("expo-router", () => ({ useRouter: jest.fn() }));

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockPush = jest.fn();

const DATE = Temporal.PlainDate.from("2026-08-09");

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push: mockPush } as never);
});

describe("CongratsStep", () => {
  // The step's whole job: it does not draw the day's tasks, it sends the reader
  // to the surface that does — on the ritual's day, not on today's, so someone
  // who walked yesterday's ritual lands on yesterday.
  it("opens the ritual's day rather than today", () => {
    render(<CongratsStep date={DATE} />);

    fireEvent.press(screen.getByText("Open your day"));

    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/today",
        params: expect.objectContaining({ date: "2026-08-09", mode: "tasks" }),
      }),
    );
  });

  // Cross-tab navigation reuses the mounted Today screen and only swaps its
  // params, so without a nonce that changes per press the second visit carries
  // identical params and Today — having already applied them — switches tabs
  // and does nothing else.
  it("varies the link on every press", () => {
    render(<CongratsStep date={DATE} />);
    const button = screen.getByText("Open your day");

    fireEvent.press(button);
    fireEvent.press(button);

    const [first] = mockPush.mock.calls[0] as [{ params: { n: string } }];
    const [second] = mockPush.mock.calls[1] as [{ params: { n: string } }];
    expect(second.params.n).not.toBe(first.params.n);
  });
});
