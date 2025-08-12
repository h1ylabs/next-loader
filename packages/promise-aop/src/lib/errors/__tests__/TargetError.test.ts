import { TargetError } from "@/lib/errors/TargetError";

describe("TargetError", () => {
  it("should create a TargetError with an error cause", () => {
    const originalError = new Error("original error");
    const targetError = new TargetError(originalError);

    expect(targetError).toBeInstanceOf(Error);
    expect(targetError.cause).toBe(originalError);
  });

  it("should handle a string error message", () => {
    const errorMessage = "string error";
    const targetError = new TargetError(errorMessage);

    expect(targetError.cause).toBe(errorMessage);
  });

  it("should handle a null error", () => {
    const targetError = new TargetError(null);

    expect(targetError.cause).toBeNull();
  });

  it("should handle an undefined error", () => {
    const targetError = new TargetError(undefined);

    expect(targetError.cause).toBeUndefined();
  });
});
