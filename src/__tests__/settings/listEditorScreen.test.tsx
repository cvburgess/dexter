import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ReactElement } from "react";

import { TList } from "@/api/lists";
import ListScreen from "@/app/(app)/(tabs)/settings/lists/[id]";
import { useLists } from "@/hooks/useLists";

jest.mock("@/hooks/useLists", () => ({ useLists: jest.fn() }));

// The picker is a native host with its own tests; this suite only exercises how
// the editor closes.
jest.mock("@/components/EmojiPicker", () => ({ EmojiPicker: () => null }));

// The prompt itself is covered by ConfirmationModal's own tests; here it only
// has to resolve so the archive path can be exercised.
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
  current: { id: "list-1" },
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

const mockUseLists = useLists as jest.MockedFunction<typeof useLists>;
const mockCreateList = jest.fn();
const mockUpdateList = jest.fn();

const makeList = (overrides: Partial<TList> = {}): TList => ({
  id: "list-1",
  title: "Work",
  emoji: "💼",
  isArchived: false,
  createdAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const renderWith = (existing?: TList) => {
  mockParams.current = { id: existing?.id ?? "new" };
  mockUseLists.mockReturnValue([
    existing ? [existing] : [],
    {
      getListById: (id: string | null) =>
        id && existing?.id === id ? existing : undefined,
      isLoading: false,
      createList: mockCreateList,
      updateList: mockUpdateList,
    },
  ] as never);
  return render(<ListScreen />);
};

const close = () => {
  const header = render(headerOptions().headerLeft());
  fireEvent.press(header.getByTestId("modal-close-button"));
};

const save = () => {
  const header = render(headerOptions().headerRight());
  fireEvent.press(header.getByTestId("modal-done-button"));
};

describe("ListScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.canDismiss.mockReturnValue(true);
    mockConfirm.mockResolvedValue(true);
  });

  // Popping, not navigating: replacing would collapse whatever sits under this
  // screen, which is what left Tasks as the root of the settings tab (DEX-93).
  it("pops when closed", () => {
    renderWith(makeList());

    close();

    expect(mockRouter.back).toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("pops after saving", () => {
    mockUpdateList.mockImplementation((_diff, { onSuccess }) => onSuccess());
    renderWith(makeList());

    save();

    expect(mockRouter.back).toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("pops after archiving", async () => {
    mockUpdateList.mockImplementation((_diff, { onSuccess }) => onSuccess());
    const screen = renderWith(makeList());

    fireEvent.press(screen.getByText("Archive"));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  });

  // The case a bare `router.back()` couldn't cover: a cold deep link straight
  // to this URL, where an unguarded pop is an unhandled GO_BACK and both header
  // buttons look dead.
  it("falls back to the list when there is nothing to pop", () => {
    mockRouter.canDismiss.mockReturnValue(false);
    renderWith(makeList());

    close();

    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith("/settings/lists");
  });
});
