import { RETRY_SIGNAL_PRIORITY } from "@/lib/models/signal";
import {
  MSG_RETRY_SIGNAL_DEFAULT_MESSAGE,
  RetrySignal,
} from "@/lib/signals/RetrySignal";
import { Signal } from "@/lib/utils/Signal";

describe("RetrySignal", () => {
  describe("constructor", () => {
    it("should create a signal with default properties when no props are provided", () => {
      const signal = new RetrySignal();

      expect(signal.message).toBe(MSG_RETRY_SIGNAL_DEFAULT_MESSAGE);
      expect(signal.priority).toBe(RETRY_SIGNAL_PRIORITY);
      expect(signal.errorReason).toBeUndefined();
      expect(signal.propagated).toBe(false);
    });

    it("should create a signal with a custom message", () => {
      const customMessage = "Custom retry message";
      const signal = new RetrySignal({
        message: customMessage,
      });

      expect(signal.message).toBe(customMessage);
      expect(signal.priority).toBe(RETRY_SIGNAL_PRIORITY);
      expect(signal.errorReason).toBeUndefined();
      expect(signal.propagated).toBe(false);
    });

    it("should create a signal with errorReason when provided", () => {
      const originalError = new Error("Original error");
      const signal = new RetrySignal({
        errorReason: originalError,
      });

      expect(signal.message).toBe(MSG_RETRY_SIGNAL_DEFAULT_MESSAGE);
      expect(signal.priority).toBe(RETRY_SIGNAL_PRIORITY);
      expect(signal.errorReason).toBe(originalError);
      expect(signal.propagated).toBe(false);
    });

    it("should create a signal with propagated flag when provided", () => {
      const signal = new RetrySignal({
        propagated: true,
      });

      expect(signal.message).toBe(MSG_RETRY_SIGNAL_DEFAULT_MESSAGE);
      expect(signal.priority).toBe(RETRY_SIGNAL_PRIORITY);
      expect(signal.errorReason).toBeUndefined();
      expect(signal.propagated).toBe(true);
    });

    it("should create a signal with both errorReason and propagated when provided", () => {
      const originalError = new Error("Propagated error");
      const signal = new RetrySignal({
        errorReason: originalError,
        propagated: true,
        message: "Custom propagated message",
      });

      expect(signal.message).toBe("Custom propagated message");
      expect(signal.priority).toBe(RETRY_SIGNAL_PRIORITY);
      expect(signal.errorReason).toBe(originalError);
      expect(signal.propagated).toBe(true);
    });

    it("should handle various error types as errorReason", () => {
      const stringError = "String error";
      const objectError = { code: 500, message: "Server error" };
      const nullError = null;

      const signal1 = new RetrySignal({ errorReason: stringError });
      const signal2 = new RetrySignal({ errorReason: objectError });
      const signal3 = new RetrySignal({ errorReason: nullError });

      expect(signal1.errorReason).toBe(stringError);
      expect(signal2.errorReason).toBe(objectError);
      expect(signal3.errorReason).toBe(nullError);
    });
  });

  describe("inheritance", () => {
    it("should extend the Signal class", () => {
      const signal = new RetrySignal();

      expect(signal).toBeInstanceOf(Signal);
      expect(signal).toBeInstanceOf(RetrySignal);
    });

    it("should be identifiable as a Signal", () => {
      const signal = new RetrySignal();
      expect(Signal.isSignal(signal)).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should be throwable and catchable", () => {
      const signal = new RetrySignal({ message: "retry needed" });

      expect(() => {
        throw signal;
      }).toThrow(signal);
    });
  });
});
