import { AdviceError } from "@/lib/errors/AdviceError";
import type { Advice } from "@/lib/models/advice";

describe("AdviceError", () => {
  it("should create an AdviceError with advice and errors", () => {
    const advice: Advice = "before";
    const errors = ["error1", "error2"];

    const adviceError = new AdviceError(advice, errors);

    expect(adviceError).toBeInstanceOf(Error);
    expect(adviceError.advice).toBe(advice);
    expect(adviceError.errors).toBe(errors);
  });

  it("should handle different advice types", () => {
    const adviceTypes: Advice[] = [
      "before",
      "after",
      "around",
      "afterReturning",
      "afterThrowing",
    ];

    adviceTypes.forEach((advice) => {
      const errors = [new Error("test error")];
      const adviceError = new AdviceError(advice, errors);

      expect(adviceError.advice).toBe(advice);
      expect(adviceError.errors).toBe(errors);
    });
  });

  it("should handle empty errors array", () => {
    const advice: Advice = "after";
    const errors: unknown[] = [];

    const adviceError = new AdviceError(advice, errors);

    expect(adviceError.advice).toBe(advice);
    expect(adviceError.errors).toEqual([]);
  });

  it("should handle mixed types in errors array", () => {
    const advice: Advice = "around";
    const errors = [new Error("error"), "string error", 123, null, undefined];

    const adviceError = new AdviceError(advice, errors);

    expect(adviceError.advice).toBe(advice);
    expect(adviceError.errors).toEqual(errors);
  });
});
