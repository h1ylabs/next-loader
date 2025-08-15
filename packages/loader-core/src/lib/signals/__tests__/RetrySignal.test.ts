import { TargetWrapper } from "@h1y/promise-aop";

import {
  MSG_RETRY_SIGNAL_DEFAULT_MESSAGE,
  RetrySignal,
} from "@/lib/signals/RetrySignal";
import { Signal } from "@/lib/utils/Signal";

describe("RetrySignal", () => {
  describe("constructor", () => {
    it("should create signal without fallback", () => {
      const signal = new RetrySignal<string>({});

      expect(signal.fallback).toBeUndefined();
      expect(signal.message).toBe(MSG_RETRY_SIGNAL_DEFAULT_MESSAGE);
    });

    it("should create signal with fallback", () => {
      const fallback: TargetWrapper<string> = () => async () =>
        "fallback result";
      const signal = new RetrySignal<string>({ fallback });

      expect(signal.fallback).toBe(fallback);
      expect(signal.message).toBe(MSG_RETRY_SIGNAL_DEFAULT_MESSAGE);
    });

    it("should create signal with custom message", () => {
      const customMessage = "Custom retry message";
      const signal = new RetrySignal<number>({ message: customMessage });

      expect(signal.fallback).toBeUndefined();
      expect(signal.message).toBe(customMessage);
    });
  });

  describe("inheritance", () => {
    it("should extend Signal class", () => {
      const signal = new RetrySignal<string>({});

      expect(signal).toBeInstanceOf(Signal);
      expect(signal).toBeInstanceOf(RetrySignal);
      expect(Signal.isSignal(signal)).toBe(true);
    });
  });

  describe("generic type safety", () => {
    it("should work with different types", () => {
      const stringSignal = new RetrySignal<string>({});
      const numberSignal = new RetrySignal<number>({});
      const objectSignal = new RetrySignal<{ id: number }>({});

      expect(stringSignal).toBeInstanceOf(RetrySignal);
      expect(numberSignal).toBeInstanceOf(RetrySignal);
      expect(objectSignal).toBeInstanceOf(RetrySignal);
    });
  });

  describe("error handling", () => {
    it("should be throwable and catchable", () => {
      const signal = new RetrySignal<string>({ message: "retry needed" });

      expect(() => {
        throw signal;
      }).toThrow(signal);
    });
  });
});
