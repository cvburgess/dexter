import { fireEvent, render } from "@testing-library/react-native";

import { ETaskPriority } from "@/api/tasks";
import { TTemplate } from "@/api/templates";
import TasksScreen from "@/app/(app)/(tabs)/settings/tasks";
import { useTemplates } from "@/hooks/useTemplates";

jest.mock("@/hooks/useTemplates", () => ({ useTemplates: jest.fn() }));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const mockUseTemplates = useTemplates as jest.MockedFunction<
  typeof useTemplates
>;

const makeTemplate = (overrides: Partial<TTemplate> = {}): TTemplate => ({
  id: "template-1",
  createdAt: "2026-07-01T00:00:00Z",
  goalId: null,
  listId: null,
  priority: ETaskPriority.NEITHER,
  schedule: "0 0 * * 1",
  title: "Water the plants",
  userId: "user-1",
  ...overrides,
});

const renderWith = (templates: TTemplate[]) => {
  mockUseTemplates.mockReturnValue([templates, {} as never]);
  return render(<TasksScreen />);
};

describe("TasksScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("explains where repeats come from when there are none", () => {
    const screen = renderWith([]);

    expect(screen.getByText(/open its menu and choose Repeat/i)).toBeTruthy();
  });

  it("lists each template with a human-readable schedule", () => {
    const screen = renderWith([makeTemplate()]);

    expect(screen.getByText("Water the plants")).toBeTruthy();
    expect(screen.getByText("Weekly on Mon")).toBeTruthy();
  });

  it("opens the editor when a template row is tapped", () => {
    const screen = renderWith([makeTemplate()]);

    fireEvent.press(screen.getByLabelText("Edit Water the plants"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/settings/tasks/[id]",
      params: { id: "template-1" },
    });
  });
});
