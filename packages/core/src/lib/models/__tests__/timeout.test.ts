import {
  createTimeoutContext,
  MSG_ERR_TIMEOUT_DELAY_INFINITE,
  MSG_ERR_TIMEOUT_DELAY_NEGATIVE,
} from "@/lib/models/timeout";

describe("createTimeoutContext", () => {
  it("should create valid context", () => {
    const input = {
      delay: 5000,
    };

    const context = createTimeoutContext(input);

    expect(context.delay).toBe(5000);
    expect(context.onTimeout).toBeUndefined();
    expect(context.pending).toBeUndefined();
  });

  it("should throw on negative delay", () => {
    const input = {
      delay: -1000,
    };

    expect(() => createTimeoutContext(input)).toThrow(
      MSG_ERR_TIMEOUT_DELAY_NEGATIVE,
    );
  });

  it("should throw on infinite delay", () => {
    const inputInfinity = {
      delay: Infinity,
    };

    const inputNaN = {
      delay: NaN,
    };

    expect(() => createTimeoutContext(inputInfinity)).toThrow(
      MSG_ERR_TIMEOUT_DELAY_INFINITE,
    );
    expect(() => createTimeoutContext(inputNaN)).toThrow(
      MSG_ERR_TIMEOUT_DELAY_INFINITE,
    );
  });
});
