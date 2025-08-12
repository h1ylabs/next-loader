import { HaltError } from "@/lib/errors/HaltError";

describe("HaltError", () => {
  it("should create a HaltError with error cause", () => {
    const originalError = new Error("original error");

    const haltError = new HaltError(originalError);

    expect(haltError).toBeInstanceOf(Error);
    expect(haltError.cause).toBe(originalError);
  });

  it("should handle string error", () => {
    const errorMessage = "string error";

    const haltError = new HaltError(errorMessage);

    expect(haltError.cause).toBe(errorMessage);
  });

  it("should handle null error", () => {
    const haltError = new HaltError(null);

    expect(haltError.cause).toBeNull();
  });

  it("should handle undefined error", () => {
    const haltError = new HaltError(undefined);

    expect(haltError.cause).toBeUndefined();
  });

  it("should handle complex object error", () => {
    const complexError = { code: 500, message: "Internal Server Error" };

    const haltError = new HaltError(complexError);

    expect(haltError.cause).toBe(complexError);
  });
});
