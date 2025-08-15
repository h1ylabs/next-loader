import { MSG_SIGNAL_DEFAULT_MESSAGE, Signal } from "@/lib/utils/Signal";

describe("Signal", () => {
  describe("constructor", () => {
    it("should create signal with default message", () => {
      const signal = new Signal();

      expect(signal.message).toBe(MSG_SIGNAL_DEFAULT_MESSAGE);
      expect(signal.name).toBe("Error");
    });

    it("should create signal with custom message", () => {
      const customMessage = "Custom signal message";
      const signal = new Signal({ message: customMessage });

      expect(signal.message).toBe(customMessage);
      expect(signal.name).toBe("Error");
    });

    it("should create signal with empty message", () => {
      const signal = new Signal({ message: "" });

      expect(signal.message).toBe("");
    });
  });

  describe("inheritance", () => {
    it("should extend Error class", () => {
      const signal = new Signal();

      expect(signal).toBeInstanceOf(Error);
      expect(signal).toBeInstanceOf(Signal);
    });

    it("should have Error properties", () => {
      const signal = new Signal({ message: "test" });

      expect(signal.message).toBe("test");
      expect(signal.name).toBe("Error");
      expect(signal.stack).toBeDefined();
    });
  });

  describe("isSignal", () => {
    it("should return true for Signal instances", () => {
      const signal = new Signal();
      const customSignal = new Signal({ message: "custom" });

      expect(Signal.isSignal(signal)).toBe(true);
      expect(Signal.isSignal(customSignal)).toBe(true);
    });

    it("should return false for non-Signal instances", () => {
      const error = new Error("regular error");
      const typeError = new TypeError("type error");
      const string = "string";
      const number = 42;
      const object = {};
      const array: unknown[] = [];
      const nullValue = null;
      const undefinedValue = undefined;

      expect(Signal.isSignal(error)).toBe(false);
      expect(Signal.isSignal(typeError)).toBe(false);
      expect(Signal.isSignal(string)).toBe(false);
      expect(Signal.isSignal(number)).toBe(false);
      expect(Signal.isSignal(object)).toBe(false);
      expect(Signal.isSignal(array)).toBe(false);
      expect(Signal.isSignal(nullValue)).toBe(false);
      expect(Signal.isSignal(undefinedValue)).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should be throwable and catchable", () => {
      const signal = new Signal({ message: "test signal" });

      expect(() => {
        throw signal;
      }).toThrow(signal);

      expect(() => {
        throw signal;
      }).toThrow("test signal");
    });

    it("should distinguish signals from regular errors in catch blocks", () => {
      const signal = new Signal({ message: "signal error" });
      const error = new Error("regular error");

      try {
        throw signal;
      } catch (caught) {
        expect(Signal.isSignal(caught)).toBe(true);
        expect((caught as Signal).message).toBe("signal error");
      }

      try {
        throw error;
      } catch (caught) {
        expect(Signal.isSignal(caught)).toBe(false);
        expect((caught as Error).message).toBe("regular error");
      }
    });
  });

  describe("edge cases", () => {
    it("should handle signal with very long message", () => {
      const longMessage = "a".repeat(1000);
      const signal = new Signal({ message: longMessage });

      expect(signal.message).toBe(longMessage);
      expect(Signal.isSignal(signal)).toBe(true);
    });

    it("should handle signal with special characters", () => {
      const specialMessage = "Signal with 🚨 special chars: @#$%^&*()";
      const signal = new Signal({ message: specialMessage });

      expect(signal.message).toBe(specialMessage);
      expect(Signal.isSignal(signal)).toBe(true);
    });

    it("should work with instanceof operator", () => {
      const signal = new Signal();

      expect(signal instanceof Signal).toBe(true);
      expect(signal instanceof Error).toBe(true);
    });
  });
});
