import { HaltError, MSG_ERROR_HALTED_ERROR } from "@/lib/errors/HaltError";
import { UnknownHaltError } from "@/lib/errors/UnknownHaltError";

describe("UnknownHaltError", () => {
  it("should extend HaltError", () => {
    const error = new Error("test error");
    const unknownHaltError = new UnknownHaltError(error);

    expect(unknownHaltError).toBeInstanceOf(HaltError);
    expect(unknownHaltError).toBeInstanceOf(Error);
  });

  it("should create UnknownHaltError with error cause", () => {
    const originalError = new Error("original error");

    const unknownHaltError = new UnknownHaltError(originalError);

    expect(unknownHaltError.cause).toBe(originalError);
    expect(unknownHaltError.message).toBe(MSG_ERROR_HALTED_ERROR);
  });

  it("should handle different error types", () => {
    const stringError = "string error";
    const numberError = 404;
    const objectError = { type: "validation", field: "email" };

    const stringHaltError = new UnknownHaltError(stringError);
    const numberHaltError = new UnknownHaltError(numberError);
    const objectHaltError = new UnknownHaltError(objectError);

    expect(stringHaltError.cause).toBe(stringError);
    expect(numberHaltError.cause).toBe(numberError);
    expect(objectHaltError.cause).toBe(objectError);

    expect(stringHaltError).toBeInstanceOf(HaltError);
    expect(numberHaltError).toBeInstanceOf(HaltError);
    expect(objectHaltError).toBeInstanceOf(HaltError);
  });

  it("should handle null and undefined errors", () => {
    const nullError = new UnknownHaltError(null);
    const undefinedError = new UnknownHaltError(undefined);

    expect(nullError.cause).toBeNull();
    expect(undefinedError.cause).toBeUndefined();
    expect(nullError).toBeInstanceOf(HaltError);
    expect(undefinedError).toBeInstanceOf(HaltError);
  });
});
