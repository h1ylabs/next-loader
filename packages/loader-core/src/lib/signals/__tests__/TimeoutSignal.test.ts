import {
  MSG_TIMEOUT_SIGNAL_DEFAULT_MESSAGE,
  TimeoutSignal,
} from "@/lib/signals/TimeoutSignal";
import { Signal } from "@/lib/utils/Signal";

describe("TimeoutSignal", () => {
  describe("constructor", () => {
    it("should create signal with required delay", () => {
      const delay = 5000;
      const signal = new TimeoutSignal({ delay });

      expect(signal.delay).toBe(delay);
      expect(signal.message).toBe(MSG_TIMEOUT_SIGNAL_DEFAULT_MESSAGE);
    });

    it("should create signal with custom message", () => {
      const customMessage = "Custom timeout message";
      const delay = 3000;
      const signal = new TimeoutSignal({ delay, message: customMessage });

      expect(signal.delay).toBe(delay);
      expect(signal.message).toBe(customMessage);
    });
  });

  describe("inheritance", () => {
    it("should extend Signal class", () => {
      const signal = new TimeoutSignal({ delay: 1000 });

      expect(signal).toBeInstanceOf(Signal);
      expect(signal).toBeInstanceOf(TimeoutSignal);
      expect(Signal.isSignal(signal)).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should be throwable and catchable", () => {
      const signal = new TimeoutSignal({ delay: 1000, message: "timeout" });

      expect(() => {
        throw signal;
      }).toThrow(signal);
    });
  });
});
