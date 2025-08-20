import { RETRY_EXCEEDED_SIGNAL_PRIORITY } from "@/lib/models/signal";
import {
  MSG_RETRY_EXCEEDED_SIGNAL_DEFAULT_MESSAGE,
  RetryExceededSignal,
} from "@/lib/signals/RetryExceededSignal";
import { Signal } from "@/lib/utils/Signal";

describe("RetryExceededSignal", () => {
  describe("constructor", () => {
    it("should create a signal with default properties when no props are provided", () => {
      const signal = new RetryExceededSignal();

      expect(signal.maxRetry).toBeNaN();
      expect(signal.message).toBe(MSG_RETRY_EXCEEDED_SIGNAL_DEFAULT_MESSAGE);
      expect(signal.priority).toBe(RETRY_EXCEEDED_SIGNAL_PRIORITY);
    });

    it("should create a signal with a specified maxRetry", () => {
      const maxRetry = 5;
      const signal = new RetryExceededSignal({ maxRetry });

      expect(signal.maxRetry).toBe(maxRetry);
      expect(signal.message).toBe(MSG_RETRY_EXCEEDED_SIGNAL_DEFAULT_MESSAGE);
      expect(signal.priority).toBe(RETRY_EXCEEDED_SIGNAL_PRIORITY);
    });

    it("should create a signal with a custom message", () => {
      const customMessage = "Custom retry exceeded message";
      const maxRetry = 3;
      const signal = new RetryExceededSignal({
        maxRetry,
        message: customMessage,
      });

      expect(signal.maxRetry).toBe(maxRetry);
      expect(signal.message).toBe(customMessage);
      expect(signal.priority).toBe(RETRY_EXCEEDED_SIGNAL_PRIORITY);
    });
  });

  describe("inheritance", () => {
    it("should extend the Signal class", () => {
      const signal = new RetryExceededSignal();

      expect(signal).toBeInstanceOf(Signal);
      expect(signal).toBeInstanceOf(RetryExceededSignal);
    });

    it("should be identifiable as a Signal", () => {
      const signal = new RetryExceededSignal();
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
