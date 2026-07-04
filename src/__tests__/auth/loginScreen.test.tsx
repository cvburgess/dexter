import { fireEvent, render, waitFor } from "@testing-library/react-native";

import LoginScreen from "@/app/(auth)/login";
import { signInWithEmail, signInWithGoogle } from "@/hooks/useAuth";

jest.mock("@/hooks/useAuth", () => ({
  signInWithEmail: jest.fn(),
  signInWithGoogle: jest.fn(),
}));

const mockSignInWithEmail = signInWithEmail as jest.MockedFunction<
  typeof signInWithEmail
>;
const mockSignInWithGoogle = signInWithGoogle as jest.MockedFunction<
  typeof signInWithGoogle
>;

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

  it("sends a magic link to the trimmed email and confirms", async () => {
    mockSignInWithEmail.mockResolvedValue({
      error: null,
    } as Awaited<ReturnType<typeof signInWithEmail>>);

    const screen = render(<LoginScreen />);

    fireEvent.changeText(
      screen.getByTestId("login-email-input"),
      "  user@example.com  ",
    );
    fireEvent.press(screen.getByTestId("login-email-button"));

    await waitFor(() => {
      expect(screen.getByTestId("login-email-sent-banner")).toBeTruthy();
    });
    expect(mockSignInWithEmail).toHaveBeenCalledWith("user@example.com");
  });

  it("shows an error message when the magic link fails to send", async () => {
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
    expect(screen.queryByTestId("login-email-sent-banner")).toBeNull();
  });

  it("returns to the email form from the confirmation state", async () => {
    mockSignInWithEmail.mockResolvedValue({
      error: null,
    } as Awaited<ReturnType<typeof signInWithEmail>>);

    const screen = render(<LoginScreen />);

    fireEvent.changeText(
      screen.getByTestId("login-email-input"),
      "user@example.com",
    );
    fireEvent.press(screen.getByTestId("login-email-button"));

    await waitFor(() => {
      expect(screen.getByTestId("login-email-sent-banner")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("login-use-different-email-button"));

    expect(screen.getByTestId("login-email-input")).toBeTruthy();
    expect(screen.queryByTestId("login-email-sent-banner")).toBeNull();
  });

  it("starts the Google sign-in flow", async () => {
    mockSignInWithGoogle.mockResolvedValue({
      error: null,
    } as Awaited<ReturnType<typeof signInWithGoogle>>);

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
