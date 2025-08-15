/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  EXPONENTIAL_BACKOFF,
  FIXED_BACKOFF,
  LINEAR_BACKOFF,
} from "@/lib/features/createBackoff";
import { createBackoffAspect } from "@/lib/features/createBackoffAspect";
import { type BackoffContext } from "@/lib/models/backoff";
import {
  createLoaderCoreContext,
  type LoaderCoreContext,
} from "@/lib/models/context";

// Mock waitFor function for testing
jest.useFakeTimers();

// Helper to create a mock LoaderCoreContext
function createMockContext<Result>(
  backoffOverrides: Partial<BackoffContext> = {},
): LoaderCoreContext<Result> {
  const baseContext = createLoaderCoreContext({
    timeout: { delay: 1000 },
    retry: { maxCount: 3, canRetryOnError: true },
    backoff: {
      strategy: FIXED_BACKOFF,
      initialDelay: 100,
    },
  });

  // Override backoff context with custom values
  return {
    ...baseContext,
    backoff: {
      ...baseContext.backoff,
      ...backoffOverrides,
    },
  } as LoaderCoreContext<Result>;
}

// Helper to create a simple target function
function createTarget<T>(result: T, shouldError = false) {
  return jest.fn(async () => {
    if (shouldError) {
      throw new Error("Target function error");
    }
    return result;
  });
}

describe("createBackoffAspect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
  });

  describe("Basic Structure", () => {
    it("should create aspect with correct name", () => {
      const aspect = createBackoffAspect<string>();
      expect(aspect.name).toBe("LOADER_BACKOFF_ASPECT");
    });

    it("should have around advice defined", () => {
      const aspect = createBackoffAspect<string>();
      expect(aspect.around).toBeDefined();
      expect(typeof aspect.around?.advice).toBe("function");
    });

    it("should use backoff context", () => {
      const aspect = createBackoffAspect<string>();
      expect(aspect.around?.use).toEqual(["backoff"]);
    });
  });

  describe("Strategy null handling", () => {
    it("should do nothing when strategy is null", async () => {
      const aspect = createBackoffAspect<string>();
      const mockAttachToTarget = jest.fn();
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        strategy: null,
        nextDelay: 100,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      // Should not call attachToTarget when strategy is null
      expect(mockAttachToTarget).not.toHaveBeenCalled();

      // nextDelay should remain unchanged
      expect(context.backoff.nextDelay).toBe(100);
    });

    it("should not modify context when strategy is null", async () => {
      const aspect = createBackoffAspect<string>();
      const mockAttachToTarget = jest.fn();
      const mockAttachToResult = jest.fn();

      const originalContext = createMockContext<string>({
        strategy: null,
        nextDelay: 50,
      });
      const originalNextDelay = originalContext.backoff.nextDelay;

      await aspect.around!.advice(originalContext, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      expect(originalContext.backoff.nextDelay).toBe(originalNextDelay);
    });
  });

  describe("Strategy execution", () => {
    it("should call strategy.next() with current delay", async () => {
      const mockStrategy = {
        type: "test" as const,
        next: jest.fn().mockReturnValue(200),
      };

      const aspect = createBackoffAspect<string>();
      const mockAttachToTarget = jest.fn();
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        strategy: mockStrategy,
        nextDelay: 100,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      // Should call strategy.next with current delay
      expect(mockStrategy.next).toHaveBeenCalledWith(100);
      expect(mockStrategy.next).toHaveBeenCalledTimes(1);
    });

    it("should update nextDelay with strategy result", async () => {
      const mockStrategy = {
        type: "test" as const,
        next: jest.fn().mockReturnValue(150),
      };

      const aspect = createBackoffAspect<string>();
      const mockAttachToTarget = jest.fn();
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        strategy: mockStrategy,
        nextDelay: 100,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      // Should update nextDelay with strategy result
      expect(context.backoff.nextDelay).toBe(150);
    });

    it("should call attachToTarget when strategy exists", async () => {
      const aspect = createBackoffAspect<string>();
      const mockAttachToTarget = jest.fn();
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        strategy: FIXED_BACKOFF,
        nextDelay: 100,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      // Should call attachToTarget with a wrapper function
      expect(mockAttachToTarget).toHaveBeenCalledWith(expect.any(Function));
      expect(mockAttachToTarget).toHaveBeenCalledTimes(1);
    });
  });

  describe("Delay application", () => {
    it("should apply delay before calling target", async () => {
      const aspect = createBackoffAspect<string>();
      const mockTarget = createTarget("test result");
      let wrapperFunction: any;

      const mockAttachToTarget = jest.fn((wrapper) => {
        wrapperFunction = wrapper;
      });
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        strategy: FIXED_BACKOFF,
        nextDelay: 1000,
      });

      // Execute advice
      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      // Get the wrapped target function
      const wrappedTarget = wrapperFunction(mockTarget);

      // Start executing the wrapped target
      const resultPromise = wrappedTarget();

      // Target should not be called yet (waiting for delay)
      expect(mockTarget).not.toHaveBeenCalled();

      // Fast-forward time by 1000ms
      jest.advanceTimersByTime(1000);

      // Wait for the promise to resolve
      await resultPromise;

      // Now target should have been called
      expect(mockTarget).toHaveBeenCalledTimes(1);
    });

    it("should preserve target function result", async () => {
      const expectedResult = "expected result";
      const aspect = createBackoffAspect<string>();
      const mockTarget = createTarget(expectedResult);
      let wrapperFunction: any;

      const mockAttachToTarget = jest.fn((wrapper) => {
        wrapperFunction = wrapper;
      });
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        strategy: FIXED_BACKOFF,
        nextDelay: 100,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      const wrappedTarget = wrapperFunction(mockTarget);
      const resultPromise = wrappedTarget();

      // Fast-forward time
      jest.advanceTimersByTime(100);

      const result = await resultPromise;

      expect(result).toBe(expectedResult);
    });

    it("should handle target function errors properly", async () => {
      const aspect = createBackoffAspect<string>();
      const mockTarget = createTarget("result", true); // shouldError = true
      let wrapperFunction: any;

      const mockAttachToTarget = jest.fn((wrapper) => {
        wrapperFunction = wrapper;
      });
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        strategy: FIXED_BACKOFF,
        nextDelay: 50,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      const wrappedTarget = wrapperFunction(mockTarget);
      const resultPromise = wrappedTarget();

      // Fast-forward time
      jest.advanceTimersByTime(50);

      // Wait for promise to settle and expect error
      await expect(resultPromise).rejects.toThrow("Target function error");
    });

    it("should work with zero delay", async () => {
      const aspect = createBackoffAspect<string>();
      const mockTarget = createTarget("zero delay result");
      let wrapperFunction: any;

      const mockAttachToTarget = jest.fn((wrapper) => {
        wrapperFunction = wrapper;
      });
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        strategy: FIXED_BACKOFF,
        nextDelay: 0,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      const wrappedTarget = wrapperFunction(mockTarget);
      const resultPromise = wrappedTarget();

      // Advance timers to ensure any scheduled promises resolve
      jest.advanceTimersByTime(0);

      const result = await resultPromise;

      // With zero delay, target should be called immediately
      expect(mockTarget).toHaveBeenCalledTimes(1);
      expect(result).toBe("zero delay result");
    });
  });

  describe("Different backoff strategies", () => {
    it("should work with LINEAR_BACKOFF strategy", async () => {
      const linearStrategy = LINEAR_BACKOFF(50);
      const aspect = createBackoffAspect<string>();
      const mockAttachToTarget = jest.fn();
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        strategy: linearStrategy,
        nextDelay: 100,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      // Should update nextDelay using linear strategy (100 + 50 = 150)
      expect(context.backoff.nextDelay).toBe(150);
    });

    it("should work with EXPONENTIAL_BACKOFF strategy", async () => {
      const exponentialStrategy = EXPONENTIAL_BACKOFF(2);
      const aspect = createBackoffAspect<string>();
      const mockAttachToTarget = jest.fn();
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        strategy: exponentialStrategy,
        nextDelay: 100,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      // Should update nextDelay using exponential strategy (100 * 2 = 200)
      expect(context.backoff.nextDelay).toBe(200);
    });

    it("should work with FIXED_BACKOFF strategy", async () => {
      const aspect = createBackoffAspect<string>();
      const mockAttachToTarget = jest.fn();
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        strategy: FIXED_BACKOFF,
        nextDelay: 100,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      // Should keep the same delay with fixed strategy
      expect(context.backoff.nextDelay).toBe(100);
    });
  });
});
