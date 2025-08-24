import { MIDDLEWARE_INVALID_SIGNAL_PRIORITY } from "@/lib/models/signal";
import {
  MiddlewareInvalidContextSignal,
  MSG_MIDDLEWARE_INVALID_CONTEXT_SIGNAL_DEFAULT_MESSAGE,
} from "@/lib/signals/MiddlewareInvalidContextSignal";
import { Signal } from "@/lib/utils/Signal";

describe("MiddlewareInvalidContextSignal", () => {
  describe("constructor", () => {
    it("should create a signal with default properties when no props are provided", () => {
      const signal = new MiddlewareInvalidContextSignal();

      expect(signal.middlewareName).toBe("");
      expect(signal.message).toBe(
        MSG_MIDDLEWARE_INVALID_CONTEXT_SIGNAL_DEFAULT_MESSAGE,
      );
      expect(signal.priority).toBe(MIDDLEWARE_INVALID_SIGNAL_PRIORITY);
    });

    it("should create a signal with a specified middlewareName", () => {
      const middlewareName = "TestMiddleware";
      const signal = new MiddlewareInvalidContextSignal({ middlewareName });

      expect(signal.middlewareName).toBe(middlewareName);
      expect(signal.message).toBe(
        MSG_MIDDLEWARE_INVALID_CONTEXT_SIGNAL_DEFAULT_MESSAGE,
      );
      expect(signal.priority).toBe(MIDDLEWARE_INVALID_SIGNAL_PRIORITY);
    });

    it("should create a signal with a custom message", () => {
      const customMessage = "Custom middleware context error";
      const middlewareName = "CustomMiddleware";
      const signal = new MiddlewareInvalidContextSignal({
        middlewareName,
        message: customMessage,
      });

      expect(signal.middlewareName).toBe(middlewareName);
      expect(signal.message).toBe(customMessage);
      expect(signal.priority).toBe(MIDDLEWARE_INVALID_SIGNAL_PRIORITY);
    });
  });

  describe("inheritance", () => {
    it("should extend the Signal class", () => {
      const signal = new MiddlewareInvalidContextSignal();

      expect(signal).toBeInstanceOf(Signal);
      expect(signal).toBeInstanceOf(MiddlewareInvalidContextSignal);
    });

    it("should be identifiable as a Signal", () => {
      const signal = new MiddlewareInvalidContextSignal();
      expect(Signal.isSignal(signal)).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should be throwable and catchable", () => {
      const signal = new MiddlewareInvalidContextSignal({
        middlewareName: "TestMiddleware",
        message: "context error",
      });

      expect(() => {
        throw signal;
      }).toThrow(signal);
    });
  });
});
