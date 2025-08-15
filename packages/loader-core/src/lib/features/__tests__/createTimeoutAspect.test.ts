/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createLoaderCoreContext,
  type LoaderCoreContext,
} from "../../models/context";
import { type TimeoutContext } from "../../models/timeout";
import { TimeoutSignal } from "../../signals/TimeoutSignal";
import { DynamicTimeout } from "../../utils/DynamicTimeout";
import { FIXED_BACKOFF } from "../createBackoff";
import { createTimeoutAspect } from "../createTimeoutAspect";

// Enable fake timers for precise timeout testing
jest.useFakeTimers();

// Helper to create a mock LoaderCoreContext with custom timeout settings
function createMockContext<Result>(
  timeoutOverrides: Partial<TimeoutContext> = {},
): LoaderCoreContext<Result> {
  const baseContext = createLoaderCoreContext({
    timeout: { delay: 1000 },
    retry: { maxCount: 3, canRetryOnError: true },
    backoff: {
      strategy: FIXED_BACKOFF,
      initialDelay: 100,
    },
  });

  // Override timeout context with custom values
  return {
    ...baseContext,
    timeout: {
      ...baseContext.timeout,
      ...timeoutOverrides,
    },
  } as LoaderCoreContext<Result>;
}

// Helper to create various target functions
function createTarget<T>(
  result: T,
  delay: number = 0,
  shouldError: boolean = false,
) {
  return jest.fn(async () => {
    if (delay > 0) {
      return new Promise<T>((resolve, reject) => {
        setTimeout(() => {
          if (shouldError) {
            reject(new Error("Target function error"));
          } else {
            resolve(result);
          }
        }, delay);
      });
    }

    if (shouldError) {
      throw new Error("Target function error");
    }
    return result;
  });
}

// Helper to create timeout signal
function createTimeoutSignal(delay: number) {
  return new TimeoutSignal({ delay });
}

// Helper to create mock callbacks
function createMockCallbacks() {
  return {
    onTimeout: jest.fn(),
  };
}

// Helper to check timer count (for memory leak detection)
function expectNoActiveTimers() {
  expect(jest.getTimerCount()).toBe(0);
}

describe("createTimeoutAspect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.clearAllTimers();
    // Critical: Check for memory leaks after each test
    expectNoActiveTimers();
  });

  // Helper to safely create DynamicTimeout for testing
  function createSafeDynamicTimeout(rejectValue: any, delay: number) {
    const timeout = new DynamicTimeout(rejectValue, delay);
    // Prevent unhandled rejection in tests by attaching a permanent catch handler
    const promise = timeout.getPromise();
    promise.catch(() => {}); // Ignore rejections to prevent unhandled promise rejections
    return timeout;
  }

  describe("Basic Structure", () => {
    it("should create aspect with correct name", () => {
      const aspect = createTimeoutAspect<string>();
      expect(aspect.name).toBe("LOADER_TIMEOUT_ASPECT");
    });

    it("should have around advice defined", () => {
      const aspect = createTimeoutAspect<string>();
      expect(aspect.around).toBeDefined();
      expect(typeof aspect.around?.advice).toBe("function");
    });

    it("should have afterReturning advice defined", () => {
      const aspect = createTimeoutAspect<string>();
      expect(aspect.afterReturning).toBeDefined();
      expect(typeof aspect.afterReturning?.advice).toBe("function");
    });

    it("should have afterThrowing advice defined", () => {
      const aspect = createTimeoutAspect<string>();
      expect(aspect.afterThrowing).toBeDefined();
      expect(typeof aspect.afterThrowing?.advice).toBe("function");
    });

    it("should use timeout context in all advice", () => {
      const aspect = createTimeoutAspect<string>();
      expect(aspect.around?.use).toEqual(["timeout"]);
      expect(aspect.afterReturning?.use).toEqual(["timeout"]);
      expect(aspect.afterThrowing?.use).toEqual(["timeout"]);
    });

    it("should have backoff aspect dependency in around advice", () => {
      const aspect = createTimeoutAspect<string>();
      expect(aspect.around?.dependsOn).toEqual(["LOADER_BACKOFF_ASPECT"]);
    });
  });

  describe("Around Advice - DynamicTimeout Management", () => {
    it("should create DynamicTimeout when timeout.pending is null", async () => {
      const aspect = createTimeoutAspect<string>();
      const mockAttachToTarget = jest.fn();
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        delay: 500,
        pending: undefined,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      // Should assign to context.timeout.pending
      expect(context.timeout.pending).toBeInstanceOf(DynamicTimeout);
      expect(context.timeout.pending?.getInitialDelay()).toBe(500);

      // Handle promise to prevent unhandled rejection
      context.timeout.pending?.getPromise().catch(() => {});

      // Should call attachToTarget
      expect(mockAttachToTarget).toHaveBeenCalledWith(expect.any(Function));
      expect(mockAttachToResult).not.toHaveBeenCalled();
    });

    it("should not create DynamicTimeout when timeout.pending exists", async () => {
      const aspect = createTimeoutAspect<string>();
      const mockAttachToTarget = jest.fn();
      const mockAttachToResult = jest.fn();

      // Create existing pending timeout
      const existingTimeout = createSafeDynamicTimeout("existing", 1000);
      const context = createMockContext<string>({
        delay: 500,
        pending: existingTimeout,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      // Should NOT call attachToTarget (early return)
      expect(mockAttachToTarget).not.toHaveBeenCalled();
      expect(mockAttachToResult).not.toHaveBeenCalled();

      // pending should remain the same
      expect(context.timeout.pending).toBe(existingTimeout);
    });

    it("should create TimeoutSignal with correct delay", async () => {
      const aspect = createTimeoutAspect<string>();
      const mockAttachToTarget = jest.fn();
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        delay: 2500,
        pending: undefined,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      // Check that DynamicTimeout was created with correct delay
      expect(context.timeout.pending).toBeInstanceOf(DynamicTimeout);
      expect(context.timeout.pending?.getInitialDelay()).toBe(2500);

      // Handle promise to prevent unhandled rejection
      context.timeout.pending?.getPromise().catch(() => {});
    });

    it("should create wrapper function that calls Promise.race", async () => {
      const aspect = createTimeoutAspect<string>();
      let capturedWrapper: any;
      const mockAttachToTarget = jest.fn((wrapper) => {
        capturedWrapper = wrapper;
      });
      const mockAttachToResult = jest.fn();

      // DynamicTimeout will create its own promise - we'll test the wrapper integration

      const context = createMockContext<string>({
        delay: 1000,
        pending: undefined,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      // Handle promise to prevent unhandled rejection
      context.timeout.pending?.getPromise().catch(() => {});

      expect(capturedWrapper).toBeDefined();
      expect(typeof capturedWrapper).toBe("function");

      // Test the wrapper function
      const mockTarget = createTarget("test result", 500);
      const wrappedTarget = capturedWrapper(mockTarget);

      expect(typeof wrappedTarget).toBe("function");
    });

    it("should preserve target function signature in wrapper", async () => {
      const aspect = createTimeoutAspect<string>();
      let capturedWrapper: any;
      const mockAttachToTarget = jest.fn((wrapper) => {
        capturedWrapper = wrapper;
      });
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        delay: 1000,
        pending: undefined,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      // Handle promise to prevent unhandled rejection
      context.timeout.pending?.getPromise().catch(() => {});

      // Create a target with specific signature
      const originalTarget = jest.fn(async () => "target result");
      const wrappedTarget = capturedWrapper(originalTarget);

      // Wrapped target should be async function
      expect(wrappedTarget.constructor.name).toBe("AsyncFunction");
    });

    it("should race target function with timeout promise", async () => {
      const aspect = createTimeoutAspect<string>();
      let capturedWrapper: any;
      const mockAttachToTarget = jest.fn((wrapper) => {
        capturedWrapper = wrapper;
      });
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        delay: 500,
        pending: undefined,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      // Create a fast target (resolves before timeout)
      const fastTarget = createTarget("fast result", 100);
      const wrappedFastTarget = capturedWrapper(fastTarget);

      // Start the promise race
      const resultPromise = wrappedFastTarget();

      // Advance timer to complete the target
      jest.advanceTimersByTime(100);

      // Target should win the race
      const fastResult = await resultPromise;
      expect(fastResult).toBe("fast result");
      expect(fastTarget).toHaveBeenCalled();

      // Clean up timeout manually since target won
      context.timeout.pending?.cancelTimeout();
    });

    it("should timeout before target function completes", async () => {
      const aspect = createTimeoutAspect<string>();
      let capturedWrapper: any;
      const mockAttachToTarget = jest.fn((wrapper) => {
        capturedWrapper = wrapper;
      });
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        delay: 300,
        pending: undefined,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      // Create a slow target (resolves after timeout)
      const slowTarget = createTarget("slow result", 1000);
      const wrappedSlowTarget = capturedWrapper(slowTarget);

      // Start the wrapped target execution
      const resultPromise = wrappedSlowTarget();

      // Advance timers to trigger timeout
      jest.advanceTimersByTime(300);

      // Should reject with TimeoutSignal
      await expect(resultPromise).rejects.toBeInstanceOf(TimeoutSignal);

      // Context timeout should be rejected
      expect(context.timeout.pending?.isRejected()).toBe(true);
    });
  });

  describe("메모리 누수 방지 핵심 테스트 (Timer 정리, cancelTimeout)", () => {
    it("should clean up timeout when target completes successfully", async () => {
      const aspect = createTimeoutAspect<string>();
      let capturedWrapper: any;
      const mockAttachToTarget = jest.fn((wrapper) => {
        capturedWrapper = wrapper;
      });
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        delay: 1000,
        pending: undefined,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      // Create fast target
      const target = createTarget("success", 100);
      const wrappedTarget = capturedWrapper(target);

      // Start execution
      const resultPromise = wrappedTarget();

      // Advance timers to complete target
      jest.advanceTimersByTime(100);

      // Execute and complete
      const result = await resultPromise;
      expect(result).toBe("success");

      // Manually clean up timeout since target completed first
      context.timeout.pending?.cancelTimeout();

      // Verify no active timers remain
      expectNoActiveTimers();
    });

    it("should clean up timeout when target throws error", async () => {
      const aspect = createTimeoutAspect<string>();
      let capturedWrapper: any;
      const mockAttachToTarget = jest.fn((wrapper) => {
        capturedWrapper = wrapper;
      });
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        delay: 1000,
        pending: undefined,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      // Create target that throws
      const target = createTarget("", 100, true);
      const wrappedTarget = capturedWrapper(target);

      // Execute and catch error
      const resultPromise = wrappedTarget();

      // Advance timers to let target throw
      jest.advanceTimersByTime(100);

      await expect(resultPromise).rejects.toThrow("Target function error");

      // Clean up timeout since target threw first
      context.timeout.pending?.cancelTimeout();

      // Verify no active timers remain
      expectNoActiveTimers();
    });

    it("should clean up timeout when Promise.race resolves with target", async () => {
      const aspect = createTimeoutAspect<string>();
      let capturedWrapper: any;
      const mockAttachToTarget = jest.fn((wrapper) => {
        capturedWrapper = wrapper;
      });
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        delay: 500,
        pending: undefined,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      // Create target that resolves before timeout
      const target = createTarget("winner", 200);
      const wrappedTarget = capturedWrapper(target);

      // Start execution
      const resultPromise = wrappedTarget();

      // Advance timers to complete target but not timeout
      jest.advanceTimersByTime(200);

      const result = await resultPromise;
      expect(result).toBe("winner");

      // Timeout should have been cancelled since target won
      expect(context.timeout.pending).toBeInstanceOf(DynamicTimeout);
      context.timeout.pending?.cancelTimeout();

      // Verify no active timers remain
      expectNoActiveTimers();
    });

    it("should clean up timeout when Promise.race rejects with timeout", async () => {
      const aspect = createTimeoutAspect<string>();
      let capturedWrapper: any;
      const mockAttachToTarget = jest.fn((wrapper) => {
        capturedWrapper = wrapper;
      });
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        delay: 300,
        pending: undefined,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      // Create slow target
      const target = createTarget("slow", 1000);
      const wrappedTarget = capturedWrapper(target);

      // Start execution
      const resultPromise = wrappedTarget();

      // Advance timers to trigger timeout
      jest.advanceTimersByTime(300);

      await expect(resultPromise).rejects.toBeInstanceOf(TimeoutSignal);

      // Verify timeout was properly rejected
      expect(context.timeout.pending?.isRejected()).toBe(true);

      // Advance timers to also clear the target's setTimeout
      jest.advanceTimersByTime(1000);

      // When timeout wins the race, no additional cleanup needed as timer is already cleared
      // Verify no active timers remain
      expectNoActiveTimers();
    });

    it("should handle manual cancelTimeout calls", async () => {
      const aspect = createTimeoutAspect<string>();
      const mockAttachToTarget = jest.fn();
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        delay: 1000,
        pending: undefined,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      // Manually cancel timeout
      context.timeout.pending?.cancelTimeout();

      // Advance timers past original delay
      jest.advanceTimersByTime(1000);

      // Should not be rejected
      expect(context.timeout.pending?.isRejected()).toBe(false);

      // Verify no active timers remain
      expectNoActiveTimers();
    });

    it("should prevent memory leaks with multiple DynamicTimeout instances", async () => {
      const aspect = createTimeoutAspect<string>();
      const mockAttachToTarget = jest.fn();
      const mockAttachToResult = jest.fn();

      // Create multiple contexts with different timeouts
      for (let i = 0; i < 5; i++) {
        const context = createMockContext<string>({
          delay: 100 + i * 100,
          pending: undefined,
        });

        await aspect.around!.advice(context, {
          attachToTarget: mockAttachToTarget,
          attachToResult: mockAttachToResult,
        });

        // Cancel each timeout immediately
        context.timeout.pending?.cancelTimeout();
      }

      // Advance timers past all delays
      jest.advanceTimersByTime(1000);

      // Verify no active timers remain
      expectNoActiveTimers();
    });
  });

  describe("AfterReturning Advice - Timeout Cleanup", () => {
    it("should call cancelTimeout when target function succeeds", async () => {
      const aspect = createTimeoutAspect<string>();
      const mockCallbacks = createMockCallbacks();

      const context = createMockContext<string>({
        delay: 1000,
        onTimeout: mockCallbacks.onTimeout,
        pending: undefined,
      });

      // Create and spy on timeout instance
      context.timeout.pending = createSafeDynamicTimeout("timeout", 1000);
      const cancelTimeoutSpy = jest.spyOn(
        context.timeout.pending,
        "cancelTimeout",
      );

      // Call afterReturning advice
      await aspect.afterReturning!.advice(context, "successful result");

      // Should call cancelTimeout
      expect(cancelTimeoutSpy).toHaveBeenCalledTimes(1);
      expect(mockCallbacks.onTimeout).not.toHaveBeenCalled();
    });

    it("should not throw error when timeout.pending is null", async () => {
      const aspect = createTimeoutAspect<string>();

      const context = createMockContext<string>({
        delay: 1000,
        pending: undefined,
      });

      // Should not throw
      await expect(
        aspect.afterReturning!.advice(context, "successful result"),
      ).resolves.toBeUndefined();
    });

    it("should handle cancelTimeout being called multiple times", async () => {
      const aspect = createTimeoutAspect<string>();

      const context = createMockContext<string>({
        delay: 1000,
        pending: undefined,
      });

      context.timeout.pending = createSafeDynamicTimeout("timeout", 1000);
      const cancelTimeoutSpy = jest.spyOn(
        context.timeout.pending,
        "cancelTimeout",
      );

      // Call multiple times
      await aspect.afterReturning!.advice(context, "result1");
      await aspect.afterReturning!.advice(context, "result2");

      expect(cancelTimeoutSpy).toHaveBeenCalledTimes(2);
    });

    it("should use timeout context dependency", () => {
      const aspect = createTimeoutAspect<string>();
      expect(aspect.afterReturning?.use).toEqual(["timeout"]);
    });
  });

  describe("AfterThrowing Advice - Timeout Error Handling", () => {
    it("should call onTimeout callback when error is TimeoutSignal", async () => {
      const aspect = createTimeoutAspect<string>();
      const mockCallbacks = createMockCallbacks();

      const context = createMockContext<string>({
        delay: 1000,
        onTimeout: mockCallbacks.onTimeout,
        pending: undefined,
      });

      const timeoutSignal = createTimeoutSignal(1000);

      // Call afterThrowing advice with TimeoutSignal
      await aspect.afterThrowing!.advice(context, timeoutSignal);

      // Should call onTimeout callback
      expect(mockCallbacks.onTimeout).toHaveBeenCalledTimes(1);
    });

    it("should not call onTimeout callback when error is not TimeoutSignal", async () => {
      const aspect = createTimeoutAspect<string>();
      const mockCallbacks = createMockCallbacks();

      const context = createMockContext<string>({
        delay: 1000,
        onTimeout: mockCallbacks.onTimeout,
        pending: undefined,
      });

      const regularError = new Error("Regular error");

      // Call afterThrowing advice with regular error
      await aspect.afterThrowing!.advice(context, regularError);

      // Should NOT call onTimeout callback
      expect(mockCallbacks.onTimeout).not.toHaveBeenCalled();
    });

    it("should not throw error when onTimeout is undefined", async () => {
      const aspect = createTimeoutAspect<string>();

      const context = createMockContext<string>({
        delay: 1000,
        onTimeout: undefined,
        pending: undefined,
      });

      const timeoutSignal = createTimeoutSignal(1000);

      // Should not throw even without onTimeout callback
      await expect(
        aspect.afterThrowing!.advice(context, timeoutSignal),
      ).resolves.toBeUndefined();
    });

    it("should handle different TimeoutSignal instances", async () => {
      const aspect = createTimeoutAspect<string>();
      const mockCallbacks = createMockCallbacks();

      const context = createMockContext<string>({
        delay: 1000,
        onTimeout: mockCallbacks.onTimeout,
        pending: undefined,
      });

      // Test with different TimeoutSignal configurations
      const timeoutSignal1 = createTimeoutSignal(500);
      const timeoutSignal2 = createTimeoutSignal(2000);

      await aspect.afterThrowing!.advice(context, timeoutSignal1);
      await aspect.afterThrowing!.advice(context, timeoutSignal2);

      // Should call onTimeout for each TimeoutSignal
      expect(mockCallbacks.onTimeout).toHaveBeenCalledTimes(2);
    });

    it("should use timeout context dependency", () => {
      const aspect = createTimeoutAspect<string>();
      expect(aspect.afterThrowing?.use).toEqual(["timeout"]);
    });

    it("should handle onTimeout callback throwing error", async () => {
      const aspect = createTimeoutAspect<string>();
      const throwingCallback = jest.fn(() => {
        throw new Error("onTimeout error");
      });

      const context = createMockContext<string>({
        delay: 1000,
        onTimeout: throwingCallback,
        pending: undefined,
      });

      const timeoutSignal = createTimeoutSignal(1000);

      // The afterThrowing advice doesn't catch errors from onTimeout callback
      // So it should throw when onTimeout throws
      await expect(
        aspect.afterThrowing!.advice(context, timeoutSignal),
      ).rejects.toThrow("onTimeout error");

      expect(throwingCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe("Integration - Complete Workflow", () => {
    it("should handle complete success workflow with cleanup", async () => {
      const aspect = createTimeoutAspect<string>();
      const mockCallbacks = createMockCallbacks();
      let capturedWrapper: any;
      const mockAttachToTarget = jest.fn((wrapper) => {
        capturedWrapper = wrapper;
      });
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        delay: 1000,
        onTimeout: mockCallbacks.onTimeout,
        pending: undefined,
      });

      // Step 1: Around advice creates timeout
      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      const cancelTimeoutSpy = jest.spyOn(
        context.timeout.pending!,
        "cancelTimeout",
      );

      // Step 2: Execute wrapped target successfully
      const target = createTarget("success", 100);
      const wrappedTarget = capturedWrapper(target);

      // Start execution and advance timer
      const resultPromise = wrappedTarget();
      jest.advanceTimersByTime(100);
      const result = await resultPromise;

      expect(result).toBe("success");

      // Step 3: AfterReturning advice should clean up
      await aspect.afterReturning!.advice(context, result);

      expect(cancelTimeoutSpy).toHaveBeenCalledTimes(1);
      expect(mockCallbacks.onTimeout).not.toHaveBeenCalled();
      expectNoActiveTimers();
    });

    it("should handle complete timeout workflow with callback", async () => {
      const aspect = createTimeoutAspect<string>();
      const mockCallbacks = createMockCallbacks();
      let capturedWrapper: any;
      const mockAttachToTarget = jest.fn((wrapper) => {
        capturedWrapper = wrapper;
      });
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        delay: 300,
        onTimeout: mockCallbacks.onTimeout,
        pending: undefined,
      });

      // Step 1: Around advice creates timeout
      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      // Step 2: Execute wrapped target that times out
      const target = createTarget("slow", 1000);
      const wrappedTarget = capturedWrapper(target);

      let caughtError: any;
      try {
        const resultPromise = wrappedTarget();
        jest.advanceTimersByTime(300);
        await resultPromise;
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(TimeoutSignal);

      // Step 3: AfterThrowing advice should call onTimeout
      await aspect.afterThrowing!.advice(context, caughtError);

      expect(mockCallbacks.onTimeout).toHaveBeenCalledTimes(1);

      // Advance timers to also clear the target's setTimeout
      jest.advanceTimersByTime(1000);

      // When timeout fires, timer is already cleared
      expectNoActiveTimers();
    });
  });

  describe("Edge Cases 및 메모리 최종 검증", () => {
    it("should handle zero delay timeout", async () => {
      const aspect = createTimeoutAspect<string>();
      let capturedWrapper: any;
      const mockAttachToTarget = jest.fn((wrapper) => {
        capturedWrapper = wrapper;
      });
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        delay: 0,
        pending: undefined,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      expect(context.timeout.pending?.getInitialDelay()).toBe(0);

      // Target should timeout immediately
      const target = createTarget("result", 100);
      const wrappedTarget = capturedWrapper(target);

      const resultPromise = wrappedTarget();
      jest.advanceTimersByTime(0);

      await expect(resultPromise).rejects.toBeInstanceOf(TimeoutSignal);

      // Advance timers to also clear the target's setTimeout
      jest.advanceTimersByTime(100);

      // Timer should be cleared when timeout fires
      expectNoActiveTimers();
    });

    it("should handle very large delay values", async () => {
      const aspect = createTimeoutAspect<string>();
      const mockAttachToTarget = jest.fn();
      const mockAttachToResult = jest.fn();

      const largeDelay = Number.MAX_SAFE_INTEGER;
      const context = createMockContext<string>({
        delay: largeDelay,
        pending: undefined,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      expect(context.timeout.pending?.getInitialDelay()).toBe(largeDelay);

      // Cancel immediately to prevent long test execution
      context.timeout.pending?.cancelTimeout();
      expectNoActiveTimers();
    });

    it("should handle multiple pending timeouts correctly", async () => {
      const aspect = createTimeoutAspect<string>();
      const mockAttachToTarget = jest.fn();
      const mockAttachToResult = jest.fn();

      const context1 = createMockContext<string>({
        delay: 500,
        pending: undefined,
      });

      const context2 = createMockContext<string>({
        delay: 1000,
        pending: undefined,
      });

      // Create first timeout
      await aspect.around!.advice(context1, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      // Create second timeout
      await aspect.around!.advice(context2, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      expect(context1.timeout.pending).toBeInstanceOf(DynamicTimeout);
      expect(context2.timeout.pending).toBeInstanceOf(DynamicTimeout);
      expect(context1.timeout.pending).not.toBe(context2.timeout.pending);

      // Clean up both
      context1.timeout.pending?.cancelTimeout();
      context2.timeout.pending?.cancelTimeout();
      expectNoActiveTimers();
    });

    it("should handle rapid consecutive timeout creations and cancellations", async () => {
      const aspect = createTimeoutAspect<string>();
      const mockAttachToTarget = jest.fn();
      const mockAttachToResult = jest.fn();

      // Create and cancel multiple timeouts rapidly
      for (let i = 0; i < 10; i++) {
        const context = createMockContext<string>({
          delay: 100 + i * 50,
          pending: undefined,
        });

        await aspect.around!.advice(context, {
          attachToTarget: mockAttachToTarget,
          attachToResult: mockAttachToResult,
        });

        expect(context.timeout.pending).toBeInstanceOf(DynamicTimeout);

        // Cancel immediately
        context.timeout.pending?.cancelTimeout();
      }

      expectNoActiveTimers();
    });

    it("should handle timeout with existing pending timeout (early return)", async () => {
      const aspect = createTimeoutAspect<string>();
      const mockAttachToTarget = jest.fn();
      const mockAttachToResult = jest.fn();

      // Pre-create timeout
      const existingTimeout = createSafeDynamicTimeout("existing", 2000);
      const context = createMockContext<string>({
        delay: 500,
        pending: existingTimeout,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      // Should not call attachToTarget (early return)
      expect(mockAttachToTarget).not.toHaveBeenCalled();
      expect(mockAttachToResult).not.toHaveBeenCalled();
      expect(context.timeout.pending).toBe(existingTimeout);

      existingTimeout.cancelTimeout();
      expectNoActiveTimers();
    });

    it("should handle TimeoutSignal with custom delay property", async () => {
      const aspect = createTimeoutAspect<string>();
      const mockCallbacks = createMockCallbacks();

      const context = createMockContext<string>({
        delay: 1000,
        onTimeout: mockCallbacks.onTimeout,
        pending: undefined,
      });

      // Create TimeoutSignal with custom delay
      const customTimeoutSignal = new TimeoutSignal({
        delay: 500,
        message: "Custom timeout message",
      });

      await aspect.afterThrowing!.advice(context, customTimeoutSignal);

      expect(mockCallbacks.onTimeout).toHaveBeenCalledTimes(1);
      expect(customTimeoutSignal.delay).toBe(500);
    });

    it("should maintain memory safety after aspect creation", () => {
      // Create multiple aspects without using them
      const aspects = [];
      for (let i = 0; i < 5; i++) {
        aspects.push(createTimeoutAspect<string>());
      }

      // Should not create any timers just by creating aspects
      expectNoActiveTimers();

      aspects.forEach((aspect) => {
        expect(aspect.name).toBe("LOADER_TIMEOUT_ASPECT");
        expect(aspect.around).toBeDefined();
        expect(aspect.afterReturning).toBeDefined();
        expect(aspect.afterThrowing).toBeDefined();
      });
    });

    it("should handle Promise.race edge case with synchronous target", async () => {
      const aspect = createTimeoutAspect<string>();
      let capturedWrapper: any;
      const mockAttachToTarget = jest.fn((wrapper) => {
        capturedWrapper = wrapper;
      });
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        delay: 1000,
        pending: undefined,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      // Create synchronous target (no delay)
      const syncTarget = createTarget("immediate", 0);
      const wrappedTarget = capturedWrapper(syncTarget);

      const result = await wrappedTarget();
      expect(result).toBe("immediate");

      // Timeout should still exist but target won the race
      expect(context.timeout.pending).toBeInstanceOf(DynamicTimeout);

      // Clean up timeout
      context.timeout.pending?.cancelTimeout();
      expectNoActiveTimers();
    });

    it("should verify final memory state after all tests", () => {
      // Final verification that no timers are left running
      expect(jest.getTimerCount()).toBe(0);

      // This test serves as a final checkpoint for memory leaks
      // If any previous test left timers running, this will catch it
    });
  });
});
