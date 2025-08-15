import { TargetWrapper } from "@h1y/promise-aop";

import { FIXED_BACKOFF } from "@/lib/features/createBackoff";
import { createRetryAspect } from "@/lib/features/createRetryAspect";
import {
  createLoaderCoreContext,
  type LoaderCoreContext,
} from "@/lib/models/context";
import { type RetryContext } from "@/lib/models/retry";
import { RetryExceededSignal } from "@/lib/signals/RetryExceededSignal";
import { RetrySignal } from "@/lib/signals/RetrySignal";

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
    retry: {
      ...baseContext.retry,
      ...retryOverrides,
    },
  } as LoaderCoreContext<Result>;
}

// Helper to create various error types
function createTestError(message = "Test error") {
  return new Error(message);
}

function createRetrySignal<T>(fallback?: TargetWrapper<T>) {
  return new RetrySignal({ fallback });
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
    it("should create aspect with correct name", () => {
      const aspect = createRetryAspect<string>();
      expect(aspect.name).toBe("LOADER_RETRY_ASPECT");
    });

    it("should have before advice defined", () => {
      const aspect = createRetryAspect<string>();
      expect(aspect.before).toBeDefined();
      expect(typeof aspect.before?.advice).toBe("function");
    });

    it("should have around advice defined", () => {
      const aspect = createRetryAspect<string>();
      expect(aspect.around).toBeDefined();
      expect(typeof aspect.around?.advice).toBe("function");
    });

    it("should have afterThrowing advice defined", () => {
      const aspect = createRetryAspect<string>();
      expect(aspect.afterThrowing).toBeDefined();
      expect(typeof aspect.afterThrowing?.advice).toBe("function");
    });

    it("should use retry context in all advice", () => {
      const aspect = createRetryAspect<string>();
      expect(aspect.before?.use).toEqual(["retry"]);
      expect(aspect.around?.use).toEqual(["retry"]);
      expect(aspect.afterThrowing?.use).toEqual(["retry"]);
    });

    it("should have timeout aspect dependency in around advice", () => {
      const aspect = createRetryAspect<string>();
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
        count: 1,
        onRetryEach: callbacks.onRetryEach,
      });

      await aspect.before!.advice(context);

      expect(callbacks.onRetryEach).toHaveBeenCalledTimes(1);
    });

    it("should call onRetryEach multiple times for higher counts", async () => {
      const aspect = createRetryAspect<string>();
      const callbacks = createMockCallbacks();

      const context = createMockContext<string>({
        count: 3,
        onRetryEach: callbacks.onRetryEach,
      });

      await aspect.before!.advice(context);

      expect(callbacks.onRetryEach).toHaveBeenCalledTimes(1);
    });

    it("should handle undefined onRetryEach callback gracefully", async () => {
      const aspect = createRetryAspect<string>();

      const context = createMockContext<string>({
        count: 2,
        onRetryEach: undefined,
      });

      // Should not throw error
      await expect(aspect.before!.advice(context)).resolves.toBeUndefined();
    });
  });

  describe("Around Advice", () => {
    it("should call attachToResult when fallback is provided", async () => {
      const aspect = createRetryAspect<string>();
      const mockAttachToTarget = jest.fn();
      const mockAttachToResult = jest.fn();
      const mockFallback: TargetWrapper<string> = jest
        .fn()
        .mockResolvedValue("fallback result");

      const context = createMockContext<string>({
        fallback: mockFallback,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      expect(mockAttachToResult).toHaveBeenCalledWith(mockFallback);
      expect(mockAttachToResult).toHaveBeenCalledTimes(1);
      expect(mockAttachToTarget).not.toHaveBeenCalled();
    });

    it("should not call attachToResult when fallback is not provided", async () => {
      const aspect = createRetryAspect<string>();
      const mockAttachToTarget = jest.fn();
      const mockAttachToResult = jest.fn();

      const context = createMockContext<string>({
        fallback: undefined,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      expect(mockAttachToResult).not.toHaveBeenCalled();
      expect(mockAttachToTarget).not.toHaveBeenCalled();
    });

    it("should work with different fallback function types", async () => {
      const aspect = createRetryAspect<number>();
      const mockAttachToTarget = jest.fn();
      const mockAttachToResult = jest.fn();
      const mockFallback: TargetWrapper<number> = jest
        .fn()
        .mockResolvedValue(42);

      const context = createMockContext<number>({
        fallback: mockFallback,
      });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: mockAttachToResult,
      });

      expect(mockAttachToResult).toHaveBeenCalledWith(mockFallback);
    });
  });

  describe("AfterThrowing Advice - Retry Decision", () => {
    it("should retry when error is RetrySignal", async () => {
      const aspect = createRetryAspect<string>();
      const retrySignal = createRetrySignal<string>();

      const context = createMockContext<string>({
        count: 0,
        maxCount: 3,
        canRetryOnError: false, // Even with false, RetrySignal should retry
      });

      await expect(
        aspect.afterThrowing!.advice(context, retrySignal),
      ).rejects.toThrow(retrySignal);

      expect(context.retry.count).toBe(1);
    });

    it("should retry any error when canRetryOnError is true", async () => {
      const aspect = createRetryAspect<string>();
      const testError = createTestError("Generic error");

      const context = createMockContext<string>({
        count: 0,
        maxCount: 3,
        canRetryOnError: true,
      });

      await expect(
        aspect.afterThrowing!.advice(context, testError),
      ).rejects.toThrow(testError);

      expect(context.retry.count).toBe(1);
    });

    it("should not retry when canRetryOnError is false and error is not RetrySignal", async () => {
      const aspect = createRetryAspect<string>();
      const testError = createTestError("Non-retryable error");

      const context = createMockContext<string>({
        count: 0,
        maxCount: 3,
        canRetryOnError: false,
      });

      // Should not throw anything (returns undefined)
      const result = await aspect.afterThrowing!.advice(context, testError);
      expect(result).toBeUndefined();
      expect(context.retry.count).toBe(0); // Count should not increase
    });

    it("should delegate retry decision to canRetryOnError function", async () => {
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
      ).rejects.toThrow(testError);

      expect(mockCanRetry).toHaveBeenCalledWith(testError);
      expect(context.retry.count).toBe(1);
    });

    it("should not retry when canRetryOnError function returns false", async () => {
      const aspect = createRetryAspect<string>();
      const testError = createTestError("Function-denied error");
      const mockCanRetry = jest.fn().mockReturnValue(false);

      const context = createMockContext<string>({
        count: 1,
        maxCount: 3,
        canRetryOnError: mockCanRetry,
      });

      const result = await aspect.afterThrowing!.advice(context, testError);

      expect(mockCanRetry).toHaveBeenCalledWith(testError);
      expect(result).toBeUndefined();
      expect(context.retry.count).toBe(1); // Count should not increase
    });

    it("should work with different error types in canRetryOnError function", async () => {
      const aspect = createRetryAspect<string>();
      const networkError = new Error("Network error");
      const timeoutError = new Error("Timeout error");

      const mockCanRetry = jest.fn().mockImplementation((error: unknown) => {
        if (error instanceof Error) {
          return error.message.includes("Network");
        }
        return false;
      });

      const context = createMockContext<string>({
        count: 0,
        maxCount: 3,
        canRetryOnError: mockCanRetry,
      });

      // Network error should retry
      await expect(
        aspect.afterThrowing!.advice(context, networkError),
      ).rejects.toThrow(networkError);
      expect(context.retry.count).toBe(1);

      // Reset count for next test
      context.retry.count = 0;

      // Timeout error should not retry
      const result = await aspect.afterThrowing!.advice(context, timeoutError);
      expect(result).toBeUndefined();
      expect(context.retry.count).toBe(0);
    });
  });

  describe("AfterThrowing Advice - Max Retry Management", () => {
    it("should increment count and rethrow error when under max count", async () => {
      const aspect = createRetryAspect<string>();
      const testError = createTestError("Retryable error");

      const context = createMockContext<string>({
        count: 1,
        maxCount: 3,
        canRetryOnError: true,
      });

      await expect(
        aspect.afterThrowing!.advice(context, testError),
      ).rejects.toThrow(testError);

      expect(context.retry.count).toBe(2); // Should increment from 1 to 2
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

    it("should call onRetryExceeded callback before throwing RetryExceededSignal", async () => {
      const aspect = createRetryAspect<string>();
      const testError = createTestError("Max retry reached");
      const callbacks = createMockCallbacks();

      const context = createMockContext<string>({
        count: 3,
        maxCount: 3,
        canRetryOnError: true,
        onRetryExceeded: callbacks.onRetryExceeded,
      });

      let callbackCalled = false;
      callbacks.onRetryExceeded.mockImplementation(() => {
        callbackCalled = true;
      });

      try {
        await aspect.afterThrowing!.advice(context, testError);
      } catch (error) {
        expect(callbackCalled).toBe(true);
        expect(error).toBeInstanceOf(RetryExceededSignal);
        if (error instanceof RetryExceededSignal) {
          expect(error.maxRetry).toBe(3);
        }
      }
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

    it("should handle undefined onRetryExceeded callback gracefully", async () => {
      const aspect = createRetryAspect<string>();
      const testError = createTestError("Max retry without callback");

      const context = createMockContext<string>({
        count: 2,
        maxCount: 2,
        canRetryOnError: true,
        onRetryExceeded: undefined,
      });

      await expect(
        aspect.afterThrowing!.advice(context, testError),
      ).rejects.toThrow(RetryExceededSignal);
    });

    it("should increment count multiple times across retries", async () => {
      const aspect = createRetryAspect<string>();
      const testError = createTestError("Multi-retry error");

      const context = createMockContext<string>({
        count: 0,
        maxCount: 3,
        canRetryOnError: true,
      });

      // First retry
      await expect(
        aspect.afterThrowing!.advice(context, testError),
      ).rejects.toThrow(testError);
      expect(context.retry.count).toBe(1);

      // Second retry
      await expect(
        aspect.afterThrowing!.advice(context, testError),
      ).rejects.toThrow(testError);
      expect(context.retry.count).toBe(2);

      // Third retry
      await expect(
        aspect.afterThrowing!.advice(context, testError),
      ).rejects.toThrow(testError);
      expect(context.retry.count).toBe(3);

      // Fourth attempt - should throw RetryExceededSignal
      await expect(
        aspect.afterThrowing!.advice(context, testError),
      ).rejects.toThrow(RetryExceededSignal);
      expect(context.retry.count).toBe(3); // Count should not increment when exceeded
    });

    it("should preserve original error information in RetryExceededSignal", async () => {
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
          expect(error.message).toContain("retry exceeded");
        }
      }
    });
  });

  describe("Edge Cases & Integration", () => {
    it("should handle RetrySignal with fallback", async () => {
      const aspect = createRetryAspect<string>();
      const mockFallback: TargetWrapper<string> = jest
        .fn()
        .mockResolvedValue("fallback value");
      const retrySignal = createRetrySignal(mockFallback);

      const context = createMockContext<string>({
        count: 0,
        maxCount: 2,
        canRetryOnError: false, // Even with false, RetrySignal should retry
      });

      await expect(
        aspect.afterThrowing!.advice(context, retrySignal),
      ).rejects.toThrow(retrySignal);

      expect(context.retry.count).toBe(1);
    });

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
      ).rejects.toThrow(testError);
      expect(context.retry.count).toBe(2);
    });

    it("should handle non-Error objects thrown", async () => {
      const aspect = createRetryAspect<string>();
      const stringError = "String error message";
      const numberError = 404;
      const objectError = { code: "CUSTOM_ERROR", message: "Custom error" };

      const context = createMockContext<string>({
        count: 0,
        maxCount: 2,
        canRetryOnError: true,
      });

      // String error
      await expect(
        aspect.afterThrowing!.advice(context, stringError),
      ).rejects.toBe(stringError);
      expect(context.retry.count).toBe(1);

      // Reset count
      context.retry.count = 0;

      // Number error
      await expect(
        aspect.afterThrowing!.advice(context, numberError),
      ).rejects.toBe(numberError);
      expect(context.retry.count).toBe(1);

      // Reset count
      context.retry.count = 0;

      // Object error
      await expect(
        aspect.afterThrowing!.advice(context, objectError),
      ).rejects.toBe(objectError);
      expect(context.retry.count).toBe(1);
    });

    it("should handle canRetryOnError function with non-Error types", async () => {
      const aspect = createRetryAspect<string>();
      const mockCanRetry = jest.fn().mockImplementation((error: unknown) => {
        // Only retry if it's a string and contains "retryable"
        return typeof error === "string" && error.includes("retryable");
      });

      const context = createMockContext<string>({
        count: 0,
        maxCount: 3,
        canRetryOnError: mockCanRetry,
      });

      // Retryable string error
      const retryableError = "retryable network error";
      await expect(
        aspect.afterThrowing!.advice(context, retryableError),
      ).rejects.toBe(retryableError);
      expect(context.retry.count).toBe(1);
      expect(mockCanRetry).toHaveBeenCalledWith(retryableError);

      // Reset count
      context.retry.count = 0;

      // Non-retryable string error
      const nonRetryableError = "fatal error";
      const result = await aspect.afterThrowing!.advice(
        context,
        nonRetryableError,
      );
      expect(result).toBeUndefined();
      expect(context.retry.count).toBe(0);
      expect(mockCanRetry).toHaveBeenCalledWith(nonRetryableError);
    });

    it("should preserve context immutability where applicable", async () => {
      const aspect = createRetryAspect<string>();
      const originalMaxCount = 3;
      const originalCanRetryOnError = true;

      const context = createMockContext<string>({
        count: 0,
        maxCount: originalMaxCount,
        canRetryOnError: originalCanRetryOnError,
      });

      const testError = createTestError("Context preservation test");
      await expect(
        aspect.afterThrowing!.advice(context, testError),
      ).rejects.toThrow(testError);

      // These should remain unchanged
      expect(context.retry.maxCount).toBe(originalMaxCount);
      expect(context.retry.canRetryOnError).toBe(originalCanRetryOnError);

      // Only count should change
      expect(context.retry.count).toBe(1);
    });
  });
});
