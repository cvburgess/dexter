import { showAlert } from "./alert";

/** `noun` completes the sentence: `showSaveError("task")` → "your task." */
export const showSaveError = (noun: string): void => {
  showAlert(
    "Something went wrong",
    `We couldn't save your ${noun}. Please try again.`,
  );
};
