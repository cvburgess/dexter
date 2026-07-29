import { showAlert } from "./alert";

/**
 * Tell the user a save failed. `noun` completes the sentence, so pass what the
 * screen was saving: `showSaveError("task")` reads "We couldn't save your task.
 * Please try again."
 */
export const showSaveError = (noun: string): void => {
  showAlert(
    "Something went wrong",
    `We couldn't save your ${noun}. Please try again.`,
  );
};
