/* eslint-disable @typescript-eslint/no-explicit-any */
import { FIXED_BACKOFF } from "@/lib/features/createBackoff";
import { createTimeoutAspect } from "@/lib/features/createTimeoutAspect";
import {
  createLoaderCoreContext,
  type LoaderCoreContext,
} from "@/lib/models/context";
import { type TimeoutContext } from "@/lib/models/timeout";
import { TimeoutSignal } from "@/lib/signals/TimeoutSignal";
import { DynamicTimeout } from "@/lib/utils/DynamicTimeout";

jest.useFakeTimers();

function createMockContext<Result>(
  timeoutOverrides: Partial<TimeoutContext> = {},
): LoaderCoreContext<Result> {
  const baseContext = createLoaderCoreContext({
    timeout: { delay: 1000 },
    retry: { maxCount: 3, canRetryOnError: true },
    backoff: { strategy: FIXED_BACKOFF, initialDelay: 100 },
  });

  return {
    ...baseContext,
    __core__timeout: { ...baseContext.__core__timeout, ...timeoutOverrides },
  } as LoaderCoreContext<Result>;
}

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
            reject(new Error("Target error"));
          } else {
            resolve(result);
          }
        }, delay);
      });
    }
    if (shouldError) throw new Error("Target error");
    return result;
  });
}

describe("createTimeoutAspect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.clearAllTimers();
    expect(jest.getTimerCount()).toBe(0);
  });

  describe("Basic Structure", () => {
    it("should create aspect with correct structure", () => {
      const aspect = createTimeoutAspect<string>();

      expect(aspect.name).toBe("LOADER_TIMEOUT_ASPECT");
      expect(aspect.around).toBeDefined();
      expect(aspect.afterReturning).toBeDefined();
      expect(aspect.afterThrowing).toBeDefined();
      expect(aspect.around?.dependsOn).toEqual(["LOADER_BACKOFF_ASPECT"]);
    });
  });

  describe("Around Advice", () => {
    it("should create DynamicTimeout and wrapper function", async () => {
      const aspect = createTimeoutAspect<string>();
      const mockAttachToTarget = jest.fn();
      const context = createMockContext<string>({ delay: 500 });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: jest.fn(),
      });

      expect(context.__core__timeout.pending).toBeInstanceOf(DynamicTimeout);
      expect(context.__core__timeout.pending?.getInitialDelay()).toBe(500);
      expect(mockAttachToTarget).toHaveBeenCalledWith(expect.any(Function));

      // Cleanup for memory leak prevention
      context.__core__timeout.pending?.getPromise().catch(() => {});
      context.__core__timeout.pending?.cancelTimeout();
    });

    it("should resolve with target result when target wins race", async () => {
      const aspect = createTimeoutAspect<string>();
      let capturedWrapper: any;
      const mockAttachToTarget = jest.fn((wrapper) => {
        capturedWrapper = wrapper;
      });
      const context = createMockContext<string>({ delay: 500 });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: jest.fn(),
      });

      const fastTarget = createTarget("success", 100);
      const wrappedTarget = capturedWrapper(fastTarget);
      const resultPromise = wrappedTarget();

      jest.advanceTimersByTime(100);
      const result = await resultPromise;

      expect(result).toBe("success");
      context.__core__timeout.pending?.cancelTimeout();
    });

    it("should reject with TimeoutSignal when timeout wins race", async () => {
      const aspect = createTimeoutAspect<string>();
      let capturedWrapper: any;
      const mockAttachToTarget = jest.fn((wrapper) => {
        capturedWrapper = wrapper;
      });
      const context = createMockContext<string>({ delay: 300 });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: jest.fn(),
      });

      const slowTarget = createTarget("slow", 1000);
      const wrappedTarget = capturedWrapper(slowTarget);
      const resultPromise = wrappedTarget();

      jest.advanceTimersByTime(300);

      await expect(resultPromise).rejects.toBeInstanceOf(TimeoutSignal);
      expect(context.__core__timeout.pending?.isRejected()).toBe(true);

      // Cleanup target timer
      jest.advanceTimersByTime(1000);
    });
  });

  describe("AfterReturning Advice", () => {
    it("should call cancelTimeout on success", async () => {
      const aspect = createTimeoutAspect<string>();
      const timeout = new DynamicTimeout(
        new TimeoutSignal({ delay: 1000 }),
        1000,
      );
      timeout.getPromise().catch(() => {}); // Prevent unhandled rejection

      const context = createMockContext<string>({ pending: timeout });
      const cancelSpy = jest.spyOn(timeout, "cancelTimeout");

      await aspect.afterReturning!.advice(context, "result");

      expect(cancelSpy).toHaveBeenCalled();
    });

    it("should handle null pending timeout", async () => {
      const aspect = createTimeoutAspect<string>();
      const context = createMockContext<string>({ pending: undefined });

      await expect(
        aspect.afterReturning!.advice(context, "result"),
      ).resolves.toBeUndefined();
    });
  });

  describe("AfterThrowing Advice", () => {
    it("should call onTimeout callback for TimeoutSignal", async () => {
      const aspect = createTimeoutAspect<string>();
      const onTimeout = jest.fn();
      const context = createMockContext<string>({ onTimeout });
      const timeoutSignal = new TimeoutSignal({ delay: 1000 });

      await aspect.afterThrowing!.advice(context, timeoutSignal);

      expect(onTimeout).toHaveBeenCalled();
    });

    it("should not call onTimeout for regular errors", async () => {
      const aspect = createTimeoutAspect<string>();
      const onTimeout = jest.fn();
      const context = createMockContext<string>({ onTimeout });
      const regularError = new Error("Regular error");

      await aspect.afterThrowing!.advice(context, regularError);

      expect(onTimeout).not.toHaveBeenCalled();
    });

    it("should handle undefined onTimeout callback", async () => {
      const aspect = createTimeoutAspect<string>();
      const context = createMockContext<string>({ onTimeout: undefined });
      const timeoutSignal = new TimeoutSignal({ delay: 1000 });

      await expect(
        aspect.afterThrowing!.advice(context, timeoutSignal),
      ).resolves.toBeUndefined();
    });
  });

  describe("Memory Management", () => {
    it("should clean up timeout when target completes", async () => {
      const aspect = createTimeoutAspect<string>();
      let capturedWrapper: any;
      const mockAttachToTarget = jest.fn((wrapper) => {
        capturedWrapper = wrapper;
      });
      const context = createMockContext<string>({ delay: 1000 });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: jest.fn(),
      });

      const target = createTarget("success", 100);
      const wrappedTarget = capturedWrapper(target);
      const resultPromise = wrappedTarget();

      jest.advanceTimersByTime(100);
      await resultPromise;

      context.__core__timeout.pending?.cancelTimeout();
      expect(jest.getTimerCount()).toBe(0);
    });

    it("should handle multiple timeout instances without leaks", async () => {
      const aspect = createTimeoutAspect<string>();
      const mockAttachToTarget = jest.fn();

      for (let i = 0; i < 3; i++) {
        const context = createMockContext<string>({ delay: 100 + i * 50 });
        await aspect.around!.advice(context, {
          attachToTarget: mockAttachToTarget,
          attachToResult: jest.fn(),
        });
        context.__core__timeout.pending?.cancelTimeout();
      }

      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero delay timeout", async () => {
      const aspect = createTimeoutAspect<string>();
      let capturedWrapper: any;
      const mockAttachToTarget = jest.fn((wrapper) => {
        capturedWrapper = wrapper;
      });
      const context = createMockContext<string>({ delay: 0 });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: jest.fn(),
      });

      const target = createTarget("result", 100);
      const wrappedTarget = capturedWrapper(target);
      const resultPromise = wrappedTarget();

      jest.advanceTimersByTime(0);

      await expect(resultPromise).rejects.toBeInstanceOf(TimeoutSignal);
      jest.advanceTimersByTime(100); // Cleanup target timer
    });

    it("should handle synchronous target", async () => {
      const aspect = createTimeoutAspect<string>();
      let capturedWrapper: any;
      const mockAttachToTarget = jest.fn((wrapper) => {
        capturedWrapper = wrapper;
      });
      const context = createMockContext<string>({ delay: 1000 });

      await aspect.around!.advice(context, {
        attachToTarget: mockAttachToTarget,
        attachToResult: jest.fn(),
      });

      const syncTarget = createTarget("immediate", 0);
      const wrappedTarget = capturedWrapper(syncTarget);
      const result = await wrappedTarget();

      expect(result).toBe("immediate");
      context.__core__timeout.pending?.cancelTimeout();
    });
  });
});
