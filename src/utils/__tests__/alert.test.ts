import { Alert } from "react-native";

import { showAlert } from "../alert";

describe("showAlert", () => {
  it("shows a titled alert", () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

    showAlert("Something went wrong", "Please try again.");

    expect(alertSpy).toHaveBeenCalledWith(
      "Something went wrong",
      "Please try again.",
    );

    alertSpy.mockRestore();
  });
});
