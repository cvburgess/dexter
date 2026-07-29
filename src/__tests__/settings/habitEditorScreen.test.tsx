import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ReactElement } from "react";

import { THabit } from "@/api/habits";
import HabitScreen from "@/app/(app)/(tabs)/settings/habits/[id]";
import { useHabits } from "@/hooks/useHabits";

jest.mock("@/hooks/useHabits", () => ({ useHabits: jest.fn() }));

// The picker is a native host with its own tests; this suite only exercises how
// the editor closes.
jest.mock("@/components/EmojiPicker", () => ({ EmojiPicker: () => null }));

// The prompt itself is covered by ConfirmationModal's own tests; here it only
// has to resolve so the archive/delete paths can be exercised.
const mockConfirm = jest.fn<Promise<boolean>, [unknown]>();
jest.mock("@/hooks/useConfirmation", () => ({
  useConfirmation: () => ({
    confirm: mockConfirm,
    confirmationProps: { visible: false, title: "", message: "", actions: [] },
  }),
}));

type THeaderOptions = {
  title?: string;
  headerLeft: () => ReactElement;
  headerRight: () => ReactElement;
};
const mockRouter = {
  back: jest.fn(),
  replace: jest.fn(),
  // `useDismissModal` guards on `canDismiss`, not the global `canGoBack`.
  canDismiss: jest.fn(() => true),
};
const mockNavigation = { setOptions: jest.fn<void, [THeaderOptions]>() };
const mockParams: { current: Record<string, string> } = {
  current: { id: "habit-1" },
};
jest.mock("expo-router", () => ({
  Redirect: function Redirect() {
    return null;
  },
  useNavigation: () => mockNavigation,
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams.current,
}));

const headerOptions = (): THeaderOptions =>
  mockNavigation.setOptions.mock.calls.at(-1)![0];

const mockUseHabits = useHabits as jest.MockedFunction<typeof useHabits>;
const mockCreateHabit = jest.fn();
const mockUpdateHabit = jest.fn();
const mockDeleteHabit = jest.fn();

const makeHabit = (overrides: Partial<THabit> = {}): THabit => ({
  id: "habit-1",
  title: "Stretch",
  emoji: "🧘",
  daysActive: [1, 2, 3, 4, 5, 6, 7],
  isArchived: false,
  isPaused: false,
  steps: 1,
  ...overrides,
});

const renderWith = (existing?: THabit) => {
  mockParams.current = { id: existing?.id ?? "new" };
  mockUseHabits.mockReturnValue([
    existing ? [existing] : [],
    {
      getHabitById: (id: string | null) =>
        id && existing?.id === id ? existing : undefined,
      isLoading: false,
      createHabit: mockCreateHabit,
      updateHabit: mockUpdateHabit,
      deleteHabit: mockDeleteHabit,
    },
  ] as never);
  return render(<HabitScreen />);
};

const close = () => {
  const header = render(headerOptions().headerLeft());
  fireEvent.press(header.getByTestId("modal-close-button"));
};

const save = () => {
  const header = render(headerOptions().headerRight());
  fireEvent.press(header.getByTestId("modal-done-button"));
};

describe("HabitScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.canDismiss.mockReturnValue(true);
    mockConfirm.mockResolvedValue(true);
  });

  // Popping, not navigating: replacing would collapse whatever sits under this
  // screen, which is what left Tasks as the root of the settings tab (DEX-93).
  it("pops when closed", () => {
    renderWith(makeHabit());

    close();

    expect(mockRouter.back).toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("pops after saving", () => {
    mockUpdateHabit.mockImplementation((_diff, { onSuccess }) => onSuccess());
    renderWith(makeHabit());

    save();

    expect(mockRouter.back).toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("pops after archiving", async () => {
    mockUpdateHabit.mockImplementation((_diff, { onSuccess }) => onSuccess());
    const screen = renderWith(makeHabit());

    fireEvent.press(screen.getByText("Archive"));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  });

  it("pops after deleting", async () => {
    mockDeleteHabit.mockImplementation((_id, { onSuccess }) => onSuccess());
    const screen = renderWith(makeHabit());

    fireEvent.press(screen.getByText("Delete"));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  });

  // The case a bare `router.back()` couldn't cover: a cold deep link straight
  // to this URL, where an unguarded pop is an unhandled GO_BACK and both header
  // buttons look dead.
  it("falls back to the list when there is nothing to pop", () => {
    mockRouter.canDismiss.mockReturnValue(false);
    renderWith(makeHabit());

    close();

    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith("/settings/habits");
  });
});
