import {
  MSG_RETRY_SIGNAL_DEFAULT_MESSAGE,
  RetrySignal,
} from "@/lib/signals/RetrySignal";
import { Signal } from "@/lib/utils/Signal";

describe("RetrySignal", () => {
  describe("constructor", () => {
    it("should create signal with default message", () => {
      const signal = new RetrySignal({});

      expect(signal.message).toBe(MSG_RETRY_SIGNAL_DEFAULT_MESSAGE);
    });

    it("should create signal with custom message", () => {
      const customMessage = "Custom retry message";
      const signal = new RetrySignal({ message: customMessage });

      expect(signal.message).toBe(customMessage);
    });
  });

  describe("inheritance", () => {
    it("should extend Signal class", () => {
      const signal = new RetrySignal({});

      expect(signal).toBeInstanceOf(Signal);
      expect(signal).toBeInstanceOf(RetrySignal);
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
