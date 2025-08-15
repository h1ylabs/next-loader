import { FIXED_BACKOFF } from "@/lib/features/createBackoff";
import {
  createBackoffContext,
  MSG_ERR_BACKOFF_INITIAL_DELAY_NEGATIVE,
} from "@/lib/models/backoff";

describe("createBackoffContext", () => {
  it("should create valid context", () => {
    const input = {
      strategy: FIXED_BACKOFF,
      initialDelay: 1000,
    };

    const context = createBackoffContext(input);

    expect(context.strategy).toBe(FIXED_BACKOFF);
    expect(context.nextDelay).toBe(1000);
  });

  it("should throw on negative initialDelay", () => {
    const input = {
      strategy: FIXED_BACKOFF,
      initialDelay: -500,
    };

    expect(() => createBackoffContext(input)).toThrow(
      MSG_ERR_BACKOFF_INITIAL_DELAY_NEGATIVE,
    );
  });
});
