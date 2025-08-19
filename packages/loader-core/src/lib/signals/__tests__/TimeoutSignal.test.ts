import { TIMEOUT_SIGNAL_PRIORITY } from "@/lib/models/signal";
import {
  MSG_TIMEOUT_SIGNAL_DEFAULT_MESSAGE,
  TimeoutSignal,
} from "@/lib/signals/TimeoutSignal";
import { Signal } from "@/lib/utils/Signal";

describe("TimeoutSignal", () => {
  describe("constructor", () => {
    it("should create a signal with default properties when no props are provided", () => {
      const signal = new TimeoutSignal();

      expect(signal.delay).toBeNaN();
      expect(signal.message).toBe(MSG_TIMEOUT_SIGNAL_DEFAULT_MESSAGE);
      expect(signal.priority).toBe(TIMEOUT_SIGNAL_PRIORITY);
    });

    it("should create a signal with a specified delay", () => {
      const delay = 5000;
      const signal = new TimeoutSignal({ delay });

      expect(signal.delay).toBe(delay);
      expect(signal.message).toBe(MSG_TIMEOUT_SIGNAL_DEFAULT_MESSAGE);
      expect(signal.priority).toBe(TIMEOUT_SIGNAL_PRIORITY);
    });

    it("should create a signal with a custom message", () => {
      const customMessage = "Custom timeout message";
      const delay = 3000;
      const signal = new TimeoutSignal({ delay, message: customMessage });

      expect(signal.delay).toBe(delay);
      expect(signal.message).toBe(customMessage);
      expect(signal.priority).toBe(TIMEOUT_SIGNAL_PRIORITY);
    });
  });

  describe("inheritance", () => {
    it("should extend the Signal class", () => {
      const signal = new TimeoutSignal();

      expect(signal).toBeInstanceOf(Signal);
      expect(signal).toBeInstanceOf(TimeoutSignal);
    });

    it("should be identifiable as a Signal", () => {
      const signal = new TimeoutSignal();
      expect(Signal.isSignal(signal)).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should be throwable and catchable", () => {
      const signal = new TimeoutSignal({
        delay: 1000,
        message: "timeout",
      });

      expect(() => {
        throw signal;
      }).toThrow(signal);
    });
  });
});
