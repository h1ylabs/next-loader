import {
  MiddlewareInvalidContextSignal,
  MSG_MIDDLEWARE_INVALID_CONTEXT_SIGNAL_DEFAULT_MESSAGE,
} from "@/lib/signals/MiddlewareInvalidContextSignal";
import { Signal } from "@/lib/utils/Signal";

describe("MiddlewareInvalidContextSignal", () => {
  describe("constructor", () => {
    it("should create signal with required middlewareName", () => {
      const middlewareName = "TestMiddleware";
      const signal = new MiddlewareInvalidContextSignal({ middlewareName });

      expect(signal.middlewareName).toBe(middlewareName);
      expect(signal.message).toBe(
        MSG_MIDDLEWARE_INVALID_CONTEXT_SIGNAL_DEFAULT_MESSAGE,
      );
    });

    it("should create signal with custom message", () => {
      const customMessage = "Custom middleware context error";
      const middlewareName = "CustomMiddleware";
      const signal = new MiddlewareInvalidContextSignal({
        middlewareName,
        message: customMessage,
      });

      expect(signal.middlewareName).toBe(middlewareName);
      expect(signal.message).toBe(customMessage);
    });
  });

  describe("inheritance", () => {
    it("should extend Signal class", () => {
      const signal = new MiddlewareInvalidContextSignal({
        middlewareName: "TestMiddleware",
      });

      expect(signal).toBeInstanceOf(Signal);
      expect(signal).toBeInstanceOf(MiddlewareInvalidContextSignal);
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
