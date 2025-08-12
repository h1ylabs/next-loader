import { UnknownError } from "@/lib/errors/UnknownError";

describe("UnknownError", () => {
  it("should create an UnknownError with an error cause", () => {
    const originalError = new Error("original error");
    const unknownError = new UnknownError(originalError);

    expect(unknownError).toBeInstanceOf(Error);
    expect(unknownError.cause).toBe(originalError);
  });

  it("should handle a string error message", () => {
    const errorMessage = "string error";
    const unknownError = new UnknownError(errorMessage);

    expect(unknownError.cause).toBe(errorMessage);
  });
});
