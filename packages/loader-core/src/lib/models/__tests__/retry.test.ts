import {
  createRetryContext,
  MSG_ERR_RETRY_COUNT_NEGATIVE,
  MSG_ERR_RETRY_COUNT_NON_INTEGER,
} from "@/lib/models/retry";

describe("createRetryContext", () => {
  it("should create valid context", () => {
    const input = {
      maxCount: 3,
      canRetryOnError: true,
    };

    const context = createRetryContext(input);

    expect(context.maxCount).toBe(3);
    expect(context.canRetryOnError).toBe(true);
    expect(context.count).toBe(0);
    expect(context.resetRequested).toBe(false);
  });

  it("should throw on negative maxCount", () => {
    const input = {
      maxCount: -1,
      canRetryOnError: true,
    };

    expect(() => createRetryContext(input)).toThrow(
      MSG_ERR_RETRY_COUNT_NEGATIVE,
    );
  });

  it("should throw on non-integer maxCount", () => {
    const input = {
      maxCount: 3.5,
      canRetryOnError: true,
    };

    expect(() => createRetryContext(input)).toThrow(
      MSG_ERR_RETRY_COUNT_NON_INTEGER,
    );
  });
});
