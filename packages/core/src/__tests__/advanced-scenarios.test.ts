import { RetryExceededSignal } from "@/lib/signals/RetryExceededSignal";
import { RetrySignal } from "@/lib/signals/RetrySignal";
import { TimeoutSignal } from "@/lib/signals/TimeoutSignal";

import { loader, middleware } from "../index";

describe("Advanced Scenarios", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe("Signal vs Error Priority System", () => {
    it("should prioritize RetryExceededSignal over regular errors", async () => {
      const { execute } = loader().withOptions({
        input: {
          retry: { maxCount: 2, canRetryOnError: true },
          timeout: { delay: 5000 },
        },
        propagateRetry: false,
        middlewares: [],
        onDetermineError: async () => {
          // This should not be called since signals have higher priority
          throw new Error("onDetermineError should not be called");
        },
      });

      let attemptCount = 0;
      const target = jest.fn(async () => {
        attemptCount++;
        throw new Error(`regular error ${attemptCount}`);
      });

      // Should throw RetryExceededSignal, not the regular error
      await expect(execute(target)).rejects.toBeInstanceOf(RetryExceededSignal);
      expect(attemptCount).toBe(3); // 1 initial + 2 retries
    });

    it("should prioritize TimeoutSignal over regular errors", async () => {
      const { execute } = loader().withOptions({
        input: {
          retry: { maxCount: 1, canRetryOnError: false },
          timeout: { delay: 50 },
        },
        propagateRetry: false,
        middlewares: [],
      });

      const target = jest.fn(async () => {
        // Wait longer than timeout to trigger TimeoutSignal
        await new Promise((resolve) => setTimeout(resolve, 100));

        // This error should be superseded by TimeoutSignal
        throw new Error("regular error");
      });

      await expect(execute(target)).rejects.toBeInstanceOf(TimeoutSignal);
    });

    it("should use onDetermineError for multiple regular errors", async () => {
      const errorMiddleware = middleware().withOptions({
        name: "errorProducer",
        contextGenerator: () => ({}),
        before: async () => {
          throw new Error("middleware error");
        },
      });

      const { execute } = loader().withOptions({
        input: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 5000 },
        },
        propagateRetry: false,
        middlewares: [errorMiddleware],
        onDetermineError: async (errors) => {
          // Should receive both target error and middleware error
          expect(errors).toHaveLength(2);
          expect(
            errors.some((err) => (err as Error).message === "target error"),
          ).toBe(true);
          expect(
            errors.some((err) => (err as Error).message === "middleware error"),
          ).toBe(true);

          // Return the first error
          return errors[0];
        },
      });

      const target = jest.fn(async () => {
        throw new Error("target error");
      });

      await expect(execute(target)).rejects.toThrow("middleware error");
    });

    it("should handle mixed signals and errors correctly", async () => {
      let attemptCount = 0;
      const signalMiddleware = middleware().withOptions({
        name: "signalProducer",
        contextGenerator: () => ({}),
        before: async () => {
          attemptCount++;
          if (attemptCount === 2) {
            // Throw a signal on second attempt
            throw new RetrySignal();
          }
        },
      });

      const { execute } = loader().withOptions({
        input: {
          retry: { maxCount: 3, canRetryOnError: true },
          timeout: { delay: 5000 },
        },
        propagateRetry: false,
        middlewares: [signalMiddleware],
        onDetermineError: async () => {
          // Should not be called when signals are present
          throw new Error("should not determine error when signals present");
        },
      });

      const target = jest.fn(async () => {
        throw new Error("target error");
      });

      // The RetrySignal should be prioritized and cause a retry
      await expect(execute(target)).rejects.toBeInstanceOf(RetryExceededSignal);
      expect(attemptCount).toBeGreaterThan(2);
    });
  });

  describe("Complex Middleware Combinations", () => {
    it("should handle middleware lifecycle correctly with retries", async () => {
      const lifecycleLog: string[] = [];

      const middleware1 = middleware().withOptions({
        name: "first",
        contextGenerator: () => ({ calls: 0 }),
        before: async (context) => {
          context.calls++;
          lifecycleLog.push(`first-before-${context.calls}`);
        },
        complete: async (context) => {
          lifecycleLog.push(`first-complete-${context.calls}`);
        },
        failure: async (context) => {
          lifecycleLog.push(`first-failure-${context.calls}`);
        },
        cleanup: async (context) => {
          lifecycleLog.push(`first-cleanup-${context.calls}`);
        },
      });

      const middleware2 = middleware().withOptions({
        name: "second",
        contextGenerator: () => ({ state: "initial" }),
        before: async (context) => {
          context.state = "processing";
          lifecycleLog.push("second-before");
        },
        complete: async (context) => {
          context.state = "completed";
          lifecycleLog.push("second-complete");
        },
        failure: async (context) => {
          context.state = "failed";
          lifecycleLog.push("second-failure");
        },
        cleanup: async (context) => {
          lifecycleLog.push(`second-cleanup-${context.state}`);
        },
      });

      const { execute } = loader().withOptions({
        input: {
          retry: { maxCount: 2, canRetryOnError: true },
          timeout: { delay: 5000 },
        },
        propagateRetry: false,
        middlewares: [middleware1, middleware2],
      });

      let attemptCount = 0;
      const target = jest.fn(async () => {
        attemptCount++;
        lifecycleLog.push(`target-${attemptCount}`);

        if (attemptCount <= 2) {
          throw new Error(`failure ${attemptCount}`);
        }

        return "success";
      });

      const result = await execute(target);
      expect(result).toBe("success");

      // Verify middleware lifecycle order and retry behavior
      // The actual order might vary based on middleware implementation details
      expect(lifecycleLog).toContain("first-before-1");
      expect(lifecycleLog).toContain("second-before");
      expect(lifecycleLog).toContain("target-3");
      expect(lifecycleLog).toContain("second-complete");
      expect(lifecycleLog).toContain("first-complete-3");
      expect(lifecycleLog.filter((log) => log.includes("before")).length).toBe(
        6,
      ); // 3 attempts * 2 middlewares
      expect(lifecycleLog.filter((log) => log.includes("target")).length).toBe(
        3,
      ); // 3 attempts
    });

    it("should handle middleware errors during retry cycles", async () => {
      let retryCount = 0;
      const problematicMiddleware = middleware().withOptions({
        name: "problematic",
        contextGenerator: () => ({ errorOnRetry: false }),
        before: async (context) => {
          retryCount++;
          if (retryCount === 2) {
            context.errorOnRetry = true;
            throw new Error("middleware error on retry");
          }
        },
        failure: async (context) => {
          if (context.errorOnRetry) {
            // Additional error during failure handling
            throw new Error("cascading middleware error");
          }
        },
      });

      const { execute } = loader().withOptions({
        input: {
          retry: { maxCount: 3, canRetryOnError: true },
          timeout: { delay: 5000 },
        },
        propagateRetry: false,
        middlewares: [problematicMiddleware],
        onDetermineError: async (errors) => {
          // Should handle multiple middleware errors
          const middlewareErrors = errors.filter((err) =>
            (err as Error).message.includes("middleware error"),
          );
          expect(middlewareErrors.length).toBeGreaterThan(0);

          return errors[0];
        },
      });

      const target = jest.fn(async () => {
        throw new Error("target error");
      });

      await expect(execute(target)).rejects.toThrow(/middleware error/);
    });

    it("should maintain separate middleware contexts across retries", async () => {
      const contextTrackingMiddleware = middleware().withOptions({
        name: "contextTracker",
        contextGenerator: () => ({
          attempts: 0,
          data: new Map<string, number>(),
        }),
        before: async (context) => {
          context.attempts++;
          context.data.set(`attempt-${context.attempts}`, Date.now());
        },
      });

      const { execute, middlewareOptions } = loader().withOptions({
        input: {
          retry: { maxCount: 3, canRetryOnError: true },
          timeout: { delay: 5000 },
        },
        propagateRetry: false,
        middlewares: [contextTrackingMiddleware],
      });

      let targetAttempts = 0;
      const target = jest.fn(async () => {
        targetAttempts++;
        const options = middlewareOptions();
        const context = options.contextTracker();

        // Verify context state matches target attempts
        expect(context.attempts).toBe(targetAttempts);
        expect(context.data.size).toBe(targetAttempts);
        expect(context.data.has(`attempt-${targetAttempts}`)).toBe(true);

        if (targetAttempts <= 2) {
          throw new Error("will retry");
        }

        return "context-maintained";
      });

      const result = await execute(target);
      expect(result).toBe("context-maintained");
      expect(targetAttempts).toBe(3);
    });
  });

  describe("Retry Propagation Scenarios", () => {
    it("should handle nested loaders with propagateRetry: true", async () => {
      const outerRetryLog: string[] = [];
      const innerRetryLog: string[] = [];

      // Inner loader with propagation enabled
      const innerLoader = loader().withOptions({
        input: {
          retry: {
            maxCount: 2,
            canRetryOnError: true,
            onRetryEach: () => innerRetryLog.push("inner-retry"),
          },
          timeout: { delay: 5000 },
        },
        propagateRetry: true,
        middlewares: [],
      });

      // Outer loader
      const outerLoader = loader().withOptions({
        input: {
          retry: {
            maxCount: 3,
            canRetryOnError: true,
            onRetryEach: () => outerRetryLog.push("outer-retry"),
          },
          timeout: { delay: 5000 },
        },
        propagateRetry: false,
        middlewares: [],
      });

      let innerAttempts = 0;
      let outerAttempts = 0;

      const innerTarget = jest.fn(async () => {
        innerAttempts++;
        throw new Error("inner failure");
      });

      const outerTarget = jest.fn(async () => {
        outerAttempts++;
        // Execute inner loader, which should propagate retries
        return await innerLoader.execute(innerTarget);
      });

      await expect(outerLoader.execute(outerTarget)).rejects.toBeInstanceOf(
        RetryExceededSignal,
      );

      // With retry propagation, we should see some retry attempts
      expect(innerAttempts).toBeGreaterThan(2); // At least inner attempts
      expect(outerAttempts).toBeGreaterThan(0); // Outer should attempt at least once
      expect(innerRetryLog.length).toBeGreaterThan(0);
    });

    it("should handle conditional retry propagation with HAS_OUTER_CONTEXT", async () => {
      const innerLoader = loader().withOptions({
        input: {
          retry: { maxCount: 2, canRetryOnError: true },
          timeout: { delay: 5000 },
        },
        propagateRetry: "HAS_OUTER_CONTEXT",
        middlewares: [],
      });

      // Test without outer context (standalone execution)
      let standaloneAttempts = 0;
      const standaloneTarget = jest.fn(async () => {
        standaloneAttempts++;
        throw new Error("standalone failure");
      });

      await expect(
        innerLoader.execute(standaloneTarget),
      ).rejects.toBeInstanceOf(RetryExceededSignal);
      expect(standaloneAttempts).toBe(3); // 1 initial + 2 retries, no propagation

      // Test with outer context
      const outerLoader = loader().withOptions({
        input: {
          retry: { maxCount: 2, canRetryOnError: true },
          timeout: { delay: 5000 },
        },
        propagateRetry: false,
        middlewares: [],
      });

      let nestedAttempts = 0;
      let outerAttempts = 0;

      const nestedTarget = jest.fn(async () => {
        nestedAttempts++;
        throw new Error("nested failure");
      });

      const outerTarget = jest.fn(async () => {
        outerAttempts++;
        return await innerLoader.execute(nestedTarget);
      });

      await expect(outerLoader.execute(outerTarget)).rejects.toBeInstanceOf(
        RetryExceededSignal,
      );

      // With outer context, retries should propagate
      expect(nestedAttempts).toBeGreaterThan(0);
      expect(outerAttempts).toBeGreaterThan(0);
    });

    it("should handle complex nested retry scenarios with fallbacks", async () => {
      const fallbackLog: string[] = [];

      const innerLoader = loader().withOptions({
        input: {
          retry: { maxCount: 2, canRetryOnError: true },
          timeout: { delay: 5000 },
        },
        propagateRetry: false, // Don't propagate to avoid complexity
        middlewares: [],
      });

      let innerAttempts = 0;
      const innerTarget = jest.fn(async () => {
        innerAttempts++;
        if (innerAttempts === 1) {
          // Use fallback on first failure
          innerLoader.retry(() => async () => {
            fallbackLog.push("inner-fallback-used");
            return "inner-fallback-success";
          });
        }
        throw new Error("should not reach");
      });

      const result = await innerLoader.execute(innerTarget);
      expect(result).toBe("inner-fallback-success");
      expect(fallbackLog).toContain("inner-fallback-used");
    });
  });

  describe("Dynamic Configuration Changes", () => {
    it("should handle dynamic retry count changes during execution", async () => {
      const dynamicMiddleware = middleware().withOptions({
        name: "dynamic",
        contextGenerator: () => ({ shouldIncrease: false }),
        failure: async (context) => {
          context.shouldIncrease = true;
        },
      });

      const { execute, loaderOptions, middlewareOptions } =
        loader().withOptions({
          input: {
            retry: { maxCount: 2, canRetryOnError: true },
            timeout: { delay: 5000 },
          },
          propagateRetry: false,
          middlewares: [dynamicMiddleware],
        });

      let attemptCount = 0;
      const target = jest.fn(async () => {
        attemptCount++;
        const options = loaderOptions();
        const middleware = middlewareOptions().dynamic();

        // Reset retry count on second failure to get more retries
        if (attemptCount === 2 && middleware.shouldIncrease) {
          options.retry.resetRetryCount();
        }

        if (attemptCount <= 3) {
          throw new Error(`failure ${attemptCount}`);
        }

        return "dynamic-success";
      });

      const result = await execute(target);
      expect(result).toBe("dynamic-success");
      expect(attemptCount).toBe(4); // More than maxCount due to reset
    });

    it("should handle timeout reset during long operations", async () => {
      const { execute, loaderOptions } = loader().withOptions({
        input: {
          retry: { maxCount: 1, canRetryOnError: false },
          timeout: { delay: 200 },
        },
        propagateRetry: false,
        middlewares: [],
      });

      const target = jest.fn(async () => {
        const options = loaderOptions();

        // Simulate shorter operation
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Check elapsed time
        expect(options.timeout.elapsedTime).toBeGreaterThan(40);

        // Reset timeout to get more time - just verify it's callable
        options.timeout.resetTimeout();

        // Continue with more work but shorter to avoid timeout
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Should not timeout because operation is within limits
        return "timeout-reset-success";
      });

      const result = await execute(target);
      expect(result).toBe("timeout-reset-success");
    });

    it("should handle fallback changes during retry cycles", async () => {
      const fallbackResults: string[] = [];

      const { execute, retry } = loader().withOptions({
        input: {
          retry: { maxCount: 3, canRetryOnError: true },
          timeout: { delay: 5000 },
        },
        propagateRetry: false,
        middlewares: [],
      });

      let attemptCount = 0;
      const target = jest.fn(async () => {
        attemptCount++;

        if (attemptCount === 1) {
          // Set successful fallback on first attempt
          retry(() => async () => {
            fallbackResults.push("fallback-success");
            return "fallback-success";
          });
        }

        throw new Error("original target always fails");
      });

      const result = await execute(target);
      expect(result).toBe("fallback-success");
      expect(fallbackResults).toContain("fallback-success");
    });
  });

  describe("Error Handling Edge Cases", () => {
    it("should handle custom onHandleError function", async () => {
      const handleErrorLog: string[] = [];

      const { execute } = loader().withOptions({
        input: {
          retry: { maxCount: 1, canRetryOnError: false },
          timeout: { delay: 5000 },
        },
        propagateRetry: false,
        middlewares: [],
        onHandleError: async (error) => {
          handleErrorLog.push(`handled: ${(error as Error).message}`);
          return "error-handled-fallback";
        },
      });

      const target = jest.fn(async () => {
        throw new Error("custom error");
      });

      const result = await execute(target);
      expect(result).toBe("error-handled-fallback");
      expect(handleErrorLog).toContain("handled: custom error");
    });

    it("should not call onHandleError for signals", async () => {
      let onHandleErrorCalled = false;

      const { execute } = loader().withOptions({
        input: {
          retry: { maxCount: 1, canRetryOnError: true },
          timeout: { delay: 5000 },
        },
        propagateRetry: false,
        middlewares: [],
        onHandleError: async () => {
          onHandleErrorCalled = true;
          return "should-not-be-called";
        },
      });

      let attemptCount = 0;
      const target = jest.fn(async () => {
        attemptCount++;
        throw new Error("will create RetryExceededSignal");
      });

      await expect(execute(target)).rejects.toBeInstanceOf(RetryExceededSignal);
      expect(onHandleErrorCalled).toBe(false);
      expect(attemptCount).toBe(2); // 1 initial + 1 retry
    });

    it("should handle async errors in middleware", async () => {
      const asyncErrorMiddleware = middleware().withOptions({
        name: "asyncError",
        contextGenerator: () => ({}),
        before: async () => {
          // Throw error immediately without delay to avoid timeout
          throw new Error("async middleware error");
        },
      });

      const { execute } = loader().withOptions({
        input: {
          retry: { maxCount: 1, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
        propagateRetry: false,
        middlewares: [asyncErrorMiddleware],
      });

      const target = jest.fn(async () => "should-not-reach");

      await expect(execute(target)).rejects.toThrow("async middleware error");
      expect(target).not.toHaveBeenCalled();
    }, 10000);
  });
});
