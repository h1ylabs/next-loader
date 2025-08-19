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
    __core__backoff: {
      ...baseContext.__core__backoff,
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
    it("should create aspect with correct name and advice", () => {
      const aspect = createBackoffAspect<string>();
      expect(aspect.name).toBe("LOADER_BACKOFF_ASPECT");
      expect(aspect.around).toBeDefined();
      expect(typeof aspect.around?.advice).toBe("function");
      expect(aspect.around?.use).toEqual(["__core__backoff"]);
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

      expect(mockAttachToTarget).not.toHaveBeenCalled();
      expect(context.__core__backoff.nextDelay).toBe(100);
    });
  });

  describe("Strategy execution", () => {
    it("should execute strategy and update delay", async () => {
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

      expect(mockStrategy.next).toHaveBeenCalledWith(100);
      expect(context.__core__backoff.nextDelay).toBe(200);
      expect(mockAttachToTarget).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe("Delay application", () => {
    it("should apply delay before calling target and preserve results/errors", async () => {
      const aspect = createBackoffAspect<string>();
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

      // Test successful result
      const mockTarget = createTarget("test result");
      const wrappedTarget = wrapperFunction(mockTarget);
      const resultPromise = wrappedTarget();

      expect(mockTarget).not.toHaveBeenCalled();
      jest.advanceTimersByTime(100);
      const result = await resultPromise;

      expect(mockTarget).toHaveBeenCalledTimes(1);
      expect(result).toBe("test result");

      // Test error handling
      const errorTarget = createTarget("result", true);
      const errorWrappedTarget = wrapperFunction(errorTarget);
      const errorPromise = errorWrappedTarget();

      jest.advanceTimersByTime(100);
      await expect(errorPromise).rejects.toThrow("Target function error");
    });
  });

  describe("Backoff strategies", () => {
    it("should work with LINEAR_BACKOFF strategy", async () => {
      const aspect = createBackoffAspect<string>();
      const context = createMockContext<string>({
        strategy: LINEAR_BACKOFF(50),
        nextDelay: 100,
      });

      await aspect.around!.advice(context, {
        attachToTarget: jest.fn(),
        attachToResult: jest.fn(),
      });

      expect(context.__core__backoff.nextDelay).toBe(150);
    });

    it("should work with EXPONENTIAL_BACKOFF strategy", async () => {
      const aspect = createBackoffAspect<string>();
      const context = createMockContext<string>({
        strategy: EXPONENTIAL_BACKOFF(2),
        nextDelay: 100,
      });

      await aspect.around!.advice(context, {
        attachToTarget: jest.fn(),
        attachToResult: jest.fn(),
      });

      expect(context.__core__backoff.nextDelay).toBe(200);
    });

    it("should work with FIXED_BACKOFF strategy", async () => {
      const aspect = createBackoffAspect<string>();
      const context = createMockContext<string>({
        strategy: FIXED_BACKOFF,
        nextDelay: 100,
      });

      await aspect.around!.advice(context, {
        attachToTarget: jest.fn(),
        attachToResult: jest.fn(),
      });

      expect(context.__core__backoff.nextDelay).toBe(100);
    });
  });
});
