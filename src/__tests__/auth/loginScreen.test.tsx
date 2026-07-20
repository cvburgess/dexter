import { fireEvent, render, waitFor } from "@testing-library/react-native";

import LoginScreen from "@/app/(auth)/login";
import {
  isDemoEmail,
  signInWithEmail,
  signInWithGoogle,
  verifyDemoOtp,
  verifyEmailOtp,
} from "@/hooks/useAuth";

jest.mock("@/hooks/useAuth", () => ({
  signInWithEmail: jest.fn(),
  signInWithGoogle: jest.fn(),
  verifyEmailOtp: jest.fn(),
  verifyDemoOtp: jest.fn(),
  isDemoEmail: (email: string) =>
    email.trim().toLowerCase() === "demo@dexterplanner.com",
}));

const mockSignInWithEmail = signInWithEmail as jest.MockedFunction<
  typeof signInWithEmail
>;
const mockSignInWithGoogle = signInWithGoogle as jest.MockedFunction<
  typeof signInWithGoogle
>;
const mockVerifyEmailOtp = verifyEmailOtp as jest.MockedFunction<
  typeof verifyEmailOtp
>;
const mockVerifyDemoOtp = verifyDemoOtp as jest.MockedFunction<
  typeof verifyDemoOtp
>;

const ok = { error: null };

describe("LoginScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders Google and email sign-in options", () => {
    const screen = render(<LoginScreen />);

    expect(screen.getByTestId("login-google-button")).toBeTruthy();
    expect(screen.getByTestId("login-email-input")).toBeTruthy();
    expect(screen.getByTestId("login-email-button")).toBeTruthy();
  });

  it("sends a login code to the trimmed email and shows the code entry", async () => {
    mockSignInWithEmail.mockResolvedValue(
      ok as Awaited<ReturnType<typeof signInWithEmail>>,
    );

    const screen = render(<LoginScreen />);

    fireEvent.changeText(
      screen.getByTestId("login-email-input"),
      "  user@example.com  ",
    );
    fireEvent.press(screen.getByTestId("login-email-button"));

    await waitFor(() => {
      expect(screen.getByTestId("login-code-sent-banner")).toBeTruthy();
    });
    expect(screen.getByTestId("login-code-input")).toBeTruthy();
    expect(mockSignInWithEmail).toHaveBeenCalledWith("user@example.com");
  });

  it("shows an error message when the login code fails to send", async () => {
    mockSignInWithEmail.mockResolvedValue({
      error: new Error("Rate limit exceeded"),
    } as unknown as Awaited<ReturnType<typeof signInWithEmail>>);

    const screen = render(<LoginScreen />);

    fireEvent.changeText(
      screen.getByTestId("login-email-input"),
      "user@example.com",
    );
    fireEvent.press(screen.getByTestId("login-email-button"));

    await waitFor(() => {
      expect(screen.getByText("Rate limit exceeded")).toBeTruthy();
    });
    expect(screen.queryByTestId("login-code-sent-banner")).toBeNull();
  });

  it("verifies the emailed code via verifyEmailOtp", async () => {
    mockSignInWithEmail.mockResolvedValue(
      ok as Awaited<ReturnType<typeof signInWithEmail>>,
    );
    mockVerifyEmailOtp.mockResolvedValue(
      ok as Awaited<ReturnType<typeof verifyEmailOtp>>,
    );

    const screen = render(<LoginScreen />);

    fireEvent.changeText(
      screen.getByTestId("login-email-input"),
      "user@example.com",
    );
    fireEvent.press(screen.getByTestId("login-email-button"));

    await waitFor(() => screen.getByTestId("login-code-input"));

    fireEvent.changeText(screen.getByTestId("login-code-input"), "123456");
    fireEvent.press(screen.getByTestId("login-verify-button"));

    await waitFor(() => {
      expect(mockVerifyEmailOtp).toHaveBeenCalledWith(
        "user@example.com",
        "123456",
      );
    });
    expect(mockVerifyDemoOtp).not.toHaveBeenCalled();
  });

  it("shows an error message when the code is invalid", async () => {
    mockSignInWithEmail.mockResolvedValue(
      ok as Awaited<ReturnType<typeof signInWithEmail>>,
    );
    mockVerifyEmailOtp.mockResolvedValue({
      error: new Error("Token has expired"),
    } as unknown as Awaited<ReturnType<typeof verifyEmailOtp>>);

    const screen = render(<LoginScreen />);

    fireEvent.changeText(
      screen.getByTestId("login-email-input"),
      "user@example.com",
    );
    fireEvent.press(screen.getByTestId("login-email-button"));

    await waitFor(() => screen.getByTestId("login-code-input"));

    fireEvent.changeText(screen.getByTestId("login-code-input"), "000000");
    fireEvent.press(screen.getByTestId("login-verify-button"));

    await waitFor(() => {
      expect(screen.getByText("Token has expired")).toBeTruthy();
    });
  });

  it("verifies the demo account via verifyDemoOtp without emailing a code", async () => {
    mockVerifyDemoOtp.mockResolvedValue(ok);

    const screen = render(<LoginScreen />);

    fireEvent.changeText(
      screen.getByTestId("login-email-input"),
      "demo@dexterplanner.com",
    );
    fireEvent.press(screen.getByTestId("login-email-button"));

    await waitFor(() => screen.getByTestId("login-code-input"));

    // The demo account skips sending email and shows no "check your email" banner.
    expect(mockSignInWithEmail).not.toHaveBeenCalled();
    expect(screen.queryByTestId("login-code-sent-banner")).toBeNull();

    fireEvent.changeText(screen.getByTestId("login-code-input"), "654321");
    fireEvent.press(screen.getByTestId("login-verify-button"));

    await waitFor(() => {
      expect(mockVerifyDemoOtp).toHaveBeenCalledWith(
        "demo@dexterplanner.com",
        "654321",
      );
    });
    expect(mockVerifyEmailOtp).not.toHaveBeenCalled();
  });

  it("returns to the email form from the code entry state", async () => {
    mockSignInWithEmail.mockResolvedValue(
      ok as Awaited<ReturnType<typeof signInWithEmail>>,
    );

    const screen = render(<LoginScreen />);

    fireEvent.changeText(
      screen.getByTestId("login-email-input"),
      "user@example.com",
    );
    fireEvent.press(screen.getByTestId("login-email-button"));

    await waitFor(() => screen.getByTestId("login-code-input"));

    fireEvent.press(screen.getByTestId("login-use-different-email-button"));

    expect(screen.getByTestId("login-email-input")).toBeTruthy();
    expect(screen.queryByTestId("login-code-input")).toBeNull();
  });

  it("starts the Google sign-in flow", async () => {
    mockSignInWithGoogle.mockResolvedValue(
      ok as Awaited<ReturnType<typeof signInWithGoogle>>,
    );

    const screen = render(<LoginScreen />);

    fireEvent.press(screen.getByTestId("login-google-button"));

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalled();
    });
  });

  it("shows an error message when Google sign-in fails", async () => {
    mockSignInWithGoogle.mockResolvedValue({
      error: new Error("OAuth error"),
    } as unknown as Awaited<ReturnType<typeof signInWithGoogle>>);

    const screen = render(<LoginScreen />);

    fireEvent.press(screen.getByTestId("login-google-button"));

    await waitFor(() => {
      expect(screen.getByText("OAuth error")).toBeTruthy();
    });
  });
});
