import { Alert } from "react-native";

import { showSaveError } from "../showSaveError";

describe("showSaveError", () => {
  // The nouns the five screens pass. These assertions are the guard that
  // extracting the helper did not quietly reword anyone's copy.
  it.each([
    ["task", "We couldn't save your task. Please try again."],
    ["changes", "We couldn't save your changes. Please try again."],
    ["list", "We couldn't save your list. Please try again."],
    ["habit", "We couldn't save your habit. Please try again."],
  ])("completes the sentence for %s", (noun, message) => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

    showSaveError(noun);

    expect(alertSpy).toHaveBeenCalledWith("Something went wrong", message);

    alertSpy.mockRestore();
  });
});
