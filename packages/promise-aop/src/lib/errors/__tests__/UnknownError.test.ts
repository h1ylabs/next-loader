import {
  MSG_ERROR_UNKNOWN_ERROR,
  UnknownError,
} from "@/lib/errors/UnknownError";

describe("UnknownError", () => {
  it("should create an UnknownError with an error cause", () => {
    const originalError = new Error("original error");
    const unknownError = new UnknownError(originalError);

    expect(unknownError).toBeInstanceOf(Error);
    expect(unknownError.cause).toBe(originalError);
    expect(unknownError.message).toBe(MSG_ERROR_UNKNOWN_ERROR);
  });

  it("should handle a string error message", () => {
    const errorMessage = "string error";
    const unknownError = new UnknownError(errorMessage);

    expect(unknownError.cause).toBe(errorMessage);
  });
});
