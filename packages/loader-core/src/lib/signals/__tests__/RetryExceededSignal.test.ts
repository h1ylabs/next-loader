import {
  MSG_RETRY_EXCEEDED_SIGNAL_DEFAULT_MESSAGE,
  RetryExceededSignal,
} from "@/lib/signals/RetryExceededSignal";
import { Signal } from "@/lib/utils/Signal";

describe("RetryExceededSignal", () => {
  describe("constructor", () => {
    it("should create signal with required maxRetry", () => {
      const maxRetry = 5;
      const signal = new RetryExceededSignal({ maxRetry });

      expect(signal.maxRetry).toBe(maxRetry);
      expect(signal.message).toBe(MSG_RETRY_EXCEEDED_SIGNAL_DEFAULT_MESSAGE);
    });

    it("should create signal with custom message", () => {
      const customMessage = "Custom retry exceeded message";
      const maxRetry = 3;
      const signal = new RetryExceededSignal({
        maxRetry,
        message: customMessage,
      });

      expect(signal.maxRetry).toBe(maxRetry);
      expect(signal.message).toBe(customMessage);
    });
  });

  describe("inheritance", () => {
    it("should extend Signal class", () => {
      const signal = new RetryExceededSignal({ maxRetry: 3 });

      expect(signal).toBeInstanceOf(Signal);
      expect(signal).toBeInstanceOf(RetryExceededSignal);
      expect(Signal.isSignal(signal)).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should be throwable and catchable", () => {
      const signal = new RetryExceededSignal({
        maxRetry: 3,
        message: "retry exceeded",
      });

      expect(() => {
        throw signal;
      }).toThrow(signal);
    });
  });
});
