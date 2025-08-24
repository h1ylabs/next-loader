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
    });

    it("should create a signal with a custom message", () => {
      const customMessage = "Custom retry message";
      const signal = new RetrySignal({
        message: customMessage,
      });

      expect(signal.message).toBe(customMessage);
      expect(signal.priority).toBe(RETRY_SIGNAL_PRIORITY);
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
