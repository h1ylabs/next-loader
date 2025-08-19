import { TargetWrapper } from "@h1y/promise-aop";

import { FIXED_BACKOFF } from "@/lib/features/createBackoff";
import { createRetryAspect } from "@/lib/features/createRetryAspect";
import {
  createLoaderCoreContext,
  type LoaderCoreContext,
} from "@/lib/models/context";
import { type RetryContext } from "@/lib/models/retry";
import { MiddlewareInvalidContextSignal } from "@/lib/signals/MiddlewareInvalidContextSignal";
import {
  MSG_RETRY_EXCEEDED_SIGNAL_DEFAULT_MESSAGE,
  RetryExceededSignal,
} from "@/lib/signals/RetryExceededSignal";
import { RetrySignal } from "@/lib/signals/RetrySignal";
import { TimeoutSignal } from "@/lib/signals/TimeoutSignal";

// Helper to create a mock LoaderCoreContext with custom retry settings
function createMockContext<Result>(
  retryOverrides: Partial<RetryContext<Result>> = {},
): LoaderCoreContext<Result> {
  const baseContext = createLoaderCoreContext({
    timeout: { delay: 1000 },
    retry: { maxCount: 3, canRetryOnError: true },
    backoff: {
      strategy: FIXED_BACKOFF,
      initialDelay: 100,
    },
  });

  // Override retry context with custom values
  return {
    ...baseContext,
    __core__retry: {
      ...baseContext.__core__retry,
      ...retryOverrides,
    },
  } as LoaderCoreContext<Result>;
}

// Helper to create various error types
function createTestError(message = "Test error") {
  return new Error(message);
}

function createRetrySignal() {
  return new RetrySignal();
}

// Helper to create mock callbacks
function createMockCallbacks() {
  return {
    onRetryEach: jest.fn(),
    onRetryExceeded: jest.fn(),
  };
}

describe("createRetryAspect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Structure", () => {
    it("should create aspect with correct structure", () => {
      const aspect = createRetryAspect<string>();
      expect(aspect.name).toBe("LOADER_RETRY_ASPECT");
      expect(aspect.before).toBeDefined();
      expect(aspect.around).toBeDefined();
      expect(aspect.afterThrowing).toBeDefined();
      expect(aspect.before?.use).toEqual(["__core__retry"]);
      expect(aspect.around?.use).toEqual(["__core__retry"]);
      expect(aspect.afterThrowing?.use).toEqual(["__core__retry"]);
      expect(aspect.around?.dependsOn).toEqual(["LOADER_TIMEOUT_ASPECT"]);
    });
  });

  describe("Before Advice", () => {
    it("should not call onRetryEach when retry count is 0", async () => {
      const aspect = createRetryAspect<string>();
      const callbacks = createMockCallbacks();

      const context = createMockContext<string>({
        count: 0,
        onRetryEach: callbacks.onRetryEach,
      });

      await aspect.before!.advice(context);

      expect(callbacks.onRetryEach).not.toHaveBeenCalled();
    });

    it("should call onRetryEach when retry count is greater than 0", async () => {
      const aspect = createRetryAspect<string>();
      const callbacks = createMockCallbacks();

      const context = createMockContext<string>({
        count: 2,
        onRetryEach: callbacks.onRetryEach,
      });

      await aspect.before!.advice(context);

      expect(callbacks.onRetryEach).toHaveBeenCalledTimes(1);
    });
  });

  describe("Around Advice", () => {
    it("should handle fallback correctly", async () => {
      const aspect = createRetryAspect<string>();
      const mockAttachToTarget = jest.fn();
      const mockAttachToResult = jest.fn();
      const mockFallback: TargetWrapper<string> = jest
        .fn()
        .mockResolvedValue("fallback result");

      // Test with fallback
      const contextWithFallback = createMockContext<string>({
        fallback: mockFallback,
      });

      await aspect.around!.advice(contextWithFallback, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      expect(mockAttachToResult).toHaveBeenCalledWith(mockFallback);

      // Reset mocks
      mockAttachToTarget.mockClear();
      mockAttachToResult.mockClear();

      // Test without fallback
      const contextWithoutFallback = createMockContext<string>({
        fallback: undefined,
      });

      await aspect.around!.advice(contextWithoutFallback, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      expect(mockAttachToResult).not.toHaveBeenCalled();
    });
  });

  describe("AfterThrowing Advice - Retry Decision", () => {
    it("should retry when error is RetrySignal", async () => {
      const aspect = createRetryAspect<string>();
      const retrySignal = createRetrySignal();

      const context = createMockContext<string>({
        count: 0,
        maxCount: 3,
        canRetryOnError: false, // Even with false, RetrySignal should retry
      });

      await expect(
        aspect.afterThrowing!.advice(context, retrySignal),
      ).rejects.toBeInstanceOf(RetrySignal);

      expect(context.__core__retry.count).toBe(1);
    });

    it("should respect canRetryOnError setting", async () => {
      const aspect = createRetryAspect<string>();
      const testError = createTestError("Generic error");

      // Test with canRetryOnError: true
      const contextWithRetry = createMockContext<string>({
        count: 0,
        maxCount: 3,
        canRetryOnError: true,
      });

      await expect(
        aspect.afterThrowing!.advice(contextWithRetry, testError),
      ).rejects.toBeInstanceOf(RetrySignal);

      expect(contextWithRetry.__core__retry.count).toBe(1);

      // Test with canRetryOnError: false
      const contextWithoutRetry = createMockContext<string>({
        count: 0,
        maxCount: 3,
        canRetryOnError: false,
      });

      const result = await aspect.afterThrowing!.advice(
        contextWithoutRetry,
        testError,
      );
      expect(result).toBeUndefined();
      expect(contextWithoutRetry.__core__retry.count).toBe(0);
    });

    it("should respect canRetryOnError function", async () => {
      const aspect = createRetryAspect<string>();
      const testError = createTestError("Function-decided error");
      const mockCanRetry = jest.fn().mockReturnValue(true);

      const context = createMockContext<string>({
        count: 0,
        maxCount: 3,
        canRetryOnError: mockCanRetry,
      });

      await expect(
        aspect.afterThrowing!.advice(context, testError),
      ).rejects.toBeInstanceOf(RetrySignal);

      expect(mockCanRetry).toHaveBeenCalledWith(testError);
      expect(context.__core__retry.count).toBe(1);
    });

    it("should not retry non-retry signals", async () => {
      const aspect = createRetryAspect<string>();
      const timeoutSignal = new TimeoutSignal({ delay: 5000 });
      const middlewareSignal = new MiddlewareInvalidContextSignal({
        middlewareName: "test-middleware",
      });

      const context = createMockContext<string>({
        count: 0,
        maxCount: 3,
        canRetryOnError: true,
      });

      // Test TimeoutSignal
      let result = await aspect.afterThrowing!.advice(context, timeoutSignal);
      expect(result).toBeUndefined();
      expect(context.__core__retry.count).toBe(0);

      // Test MiddlewareInvalidContextSignal
      result = await aspect.afterThrowing!.advice(context, middlewareSignal);
      expect(result).toBeUndefined();
      expect(context.__core__retry.count).toBe(0);
    });
  });

  describe("AfterThrowing Advice - Max Retry Management", () => {
    it("should increment count and retry when under max count", async () => {
      const aspect = createRetryAspect<string>();
      const testError = createTestError("Retryable error");

      const context = createMockContext<string>({
        count: 1,
        maxCount: 3,
        canRetryOnError: true,
      });

      await expect(
        aspect.afterThrowing!.advice(context, testError),
      ).rejects.toBeInstanceOf(RetrySignal);

      expect(context.__core__retry.count).toBe(2);
    });

    it("should throw RetryExceededSignal when reaching max count", async () => {
      const aspect = createRetryAspect<string>();
      const testError = createTestError("Final retry error");
      const callbacks = createMockCallbacks();

      const context = createMockContext<string>({
        count: 3, // At max count
        maxCount: 3,
        canRetryOnError: true,
        onRetryExceeded: callbacks.onRetryExceeded,
      });

      await expect(
        aspect.afterThrowing!.advice(context, testError),
      ).rejects.toThrow(RetryExceededSignal);

      expect(callbacks.onRetryExceeded).toHaveBeenCalledTimes(1);
    });

    it("should handle maxCount = 0 (no retries allowed)", async () => {
      const aspect = createRetryAspect<string>();
      const testError = createTestError("No retries allowed");
      const callbacks = createMockCallbacks();

      const context = createMockContext<string>({
        count: 0,
        maxCount: 0,
        canRetryOnError: true,
        onRetryExceeded: callbacks.onRetryExceeded,
      });

      await expect(
        aspect.afterThrowing!.advice(context, testError),
      ).rejects.toThrow(RetryExceededSignal);

      expect(callbacks.onRetryExceeded).toHaveBeenCalledTimes(1);
    });

    it("should preserve error information in RetryExceededSignal", async () => {
      const aspect = createRetryAspect<string>();
      const testError = createTestError("Original error");

      const context = createMockContext<string>({
        count: 1,
        maxCount: 1,
        canRetryOnError: true,
      });

      try {
        await aspect.afterThrowing!.advice(context, testError);
      } catch (error) {
        expect(error).toBeInstanceOf(RetryExceededSignal);
        if (error instanceof RetryExceededSignal) {
          expect(error.maxRetry).toBe(1);
          expect(error.message).toContain(
            MSG_RETRY_EXCEEDED_SIGNAL_DEFAULT_MESSAGE,
          );
        }
      }
    });
  });

  describe("Integration", () => {
    it("should work with complex integration scenario", async () => {
      const aspect = createRetryAspect<string>();
      const callbacks = createMockCallbacks();
      const mockFallback: TargetWrapper<string> = jest
        .fn()
        .mockResolvedValue("integrated fallback");
      const mockAttachToTarget = jest.fn();
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        count: 1, // Already tried once
        maxCount: 3,
        canRetryOnError: true,
        fallback: mockFallback,
        onRetryEach: callbacks.onRetryEach,
        onRetryExceeded: callbacks.onRetryExceeded,
      });

      // Test before advice
      await aspect.before!.advice(context);
      expect(callbacks.onRetryEach).toHaveBeenCalledTimes(1);

      // Test around advice
      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });
      expect(mockAttachToResult).toHaveBeenCalledWith(mockFallback);

      // Test afterThrowing advice
      const testError = createTestError("Integration error");
      await expect(
        aspect.afterThrowing!.advice(context, testError),
      ).rejects.toBeInstanceOf(RetrySignal);
      expect(context.__core__retry.count).toBe(2);
    });
  });
});
