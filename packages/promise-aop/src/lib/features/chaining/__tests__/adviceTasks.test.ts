/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  createCommonAdvices,
  createCommonTarget,
  createIdDataContext,
  createProcessOptionsMock,
} from "@/__tests__/test-utils";
import {
  afterAdviceTask,
  afterReturningAdviceTask,
  afterThrowingAdviceTask,
  aroundAdviceTask,
  beforeAdviceTask,
  executeTargetTask,
} from "@/lib/features/chaining/adviceTasks";
import { AdviceChainContext } from "@/lib/features/chaining/context";
import { AspectOrganization } from "@/lib/models/aspect";
import {
  defaultBuildOptions,
  RequiredBuildOptions,
} from "@/lib/models/buildOptions";
import { RequiredProcessOptions } from "@/lib/models/processOptions";
import { Target } from "@/lib/models/target";

describe("adviceTasks", () => {
  type TestResult = number;
  type TestSharedContext = {
    readonly id: string;
    readonly data: number;
  };

  const createMockTarget = (value: TestResult): Target<TestResult> =>
    createCommonTarget(value);

  const createMockContext = (): (() => TestSharedContext) =>
    createIdDataContext("test", 42);

  const createMockAdvices = (
    overrides: Partial<AspectOrganization<TestResult, TestSharedContext>> = {},
  ): AspectOrganization<TestResult, TestSharedContext> =>
    createCommonAdvices<TestResult, TestSharedContext>(overrides);

  const createMockBuildOptions = (): RequiredBuildOptions =>
    defaultBuildOptions();

  const createMockProcessOptions = (): RequiredProcessOptions<
    TestResult,
    TestSharedContext
  > => createProcessOptionsMock<TestResult, TestSharedContext>();

  const createMockChainContext = (
    overrides: Partial<AdviceChainContext<TestResult, TestSharedContext>> = {},
  ): (() => AdviceChainContext<TestResult, TestSharedContext>) => {
    const context: AdviceChainContext<TestResult, TestSharedContext> = {
      target: createMockTarget(100),
      context: createMockContext(),
      exit: <T>(callback: () => T) => callback(),
      advices: createMockAdvices(),
      buildOptions: createMockBuildOptions(),
      processOptions: createMockProcessOptions(),
      continueRejections: [],
      ...overrides,
    };
    return () => context;
  };

  describe("beforeAdviceTask", () => {
    it("should execute before advice with correct context", async () => {
      const mockAdvices = createMockAdvices({
        before: jest.fn().mockResolvedValue(undefined),
      });
      const chainContext = createMockChainContext({ advices: mockAdvices });

      const task = beforeAdviceTask(chainContext);
      await expect(task()).resolves.toBeUndefined();

      expect(mockAdvices.before).toHaveBeenCalledTimes(1);
      expect(mockAdvices.before).toHaveBeenCalledWith({ id: "test", data: 42 });
    });
  });

  describe("aroundAdviceTask", () => {
    it.each([
      {
        name: "wrapper composition",
        resolver:
          (target: Target<TestResult>) =>
          (nextChain: (t: Target<TestResult>) => Target<TestResult>) => {
            const wrappedTarget = async () => {
              const result = await target();
              return result + 1;
            };
            return nextChain(wrappedTarget);
          },
        targetValue: 10,
        expectedResult: 11,
      },
      {
        name: "identity resolver",
        resolver:
          (target: Target<TestResult>) =>
          (nextChain: (t: Target<TestResult>) => Target<TestResult>) => {
            return nextChain(target);
          },
        targetValue: 5,
        expectedResult: 5,
      },
      {
        name: "double resolver",
        resolver:
          (target: Target<TestResult>) =>
          (nextChain: (t: Target<TestResult>) => Target<TestResult>) => {
            const wrappedTarget = async () => {
              const result = await target();
              return result * 2;
            };
            return nextChain(wrappedTarget);
          },
        targetValue: 3,
        expectedResult: 6,
      },
    ])(
      "should process around advice with $name",
      async ({ resolver, targetValue, expectedResult }) => {
        const mockProcessAroundAdvice = jest.fn().mockResolvedValue(resolver);
        const chainContext = createMockChainContext({
          target: createMockTarget(targetValue),
        });

        const task = aroundAdviceTask(chainContext, mockProcessAroundAdvice);
        const result = await task();

        expect(mockProcessAroundAdvice).toHaveBeenCalledWith({
          context: { id: "test", data: 42 },
          around: expect.any(Function),
        });

        expect(typeof result).toBe("function");
        // Ensure non-null resolver, then pass a nextChain
        if (result === null) {
          throw new Error("Expected non-null AroundAdviceResolver");
        }
        const nextChain = (target: Target<TestResult>) => target;
        const finalTarget = result(nextChain);
        const wrappedResult = await finalTarget();
        expect(wrappedResult).toBe(expectedResult);
      },
    );

    it("should handle fallback resolver correctly", async () => {
      const fallbackValue = -999;
      const mockProcessAroundAdvice = jest
        .fn()
        .mockResolvedValue(
          (_: Target<TestResult>) =>
            (_: (t: Target<TestResult>) => Target<TestResult>) =>
            async () =>
              fallbackValue,
        );
      const chainContext = createMockChainContext();

      const task = aroundAdviceTask(chainContext, mockProcessAroundAdvice);
      const result = await task();

      expect(typeof result).toBe("function");
      const nextChain = (target: Target<TestResult>) => target;
      if (result === null) {
        throw new Error("Expected non-null AroundAdviceResolver");
      }
      const finalTarget = result(nextChain);
      const wrappedResult = await finalTarget();
      expect(wrappedResult).toBe(fallbackValue);
    });
  });

  describe("executeTargetTask", () => {
    it("should execute target function successfully", async () => {
      const target = createMockTarget(42);
      const result = await executeTargetTask(target);
      expect(result).toBe(42);
    });

    it("should execute fallback target and return fallback value", async () => {
      const fallbackValue = -777;
      const fallbackTarget = async () => fallbackValue;
      const result = await executeTargetTask(fallbackTarget);
      expect(result).toBe(fallbackValue);
    });

    it("should propagate target execution results", async () => {
      const target = createMockTarget(123);
      const result = await executeTargetTask(target);
      expect(result).toBe(123);
    });
  });

  describe("afterReturningAdviceTask", () => {
    it("should execute afterReturning advice with normal result and return original result", async () => {
      const mockAdvices = createMockAdvices({
        afterReturning: jest.fn().mockResolvedValue(undefined),
      });
      const chainContext = createMockChainContext({ advices: mockAdvices });

      const task = afterReturningAdviceTask(chainContext);
      const result = await task(42);

      expect(mockAdvices.afterReturning).toHaveBeenCalledTimes(1);
      expect(mockAdvices.afterReturning).toHaveBeenCalledWith(
        {
          id: "test",
          data: 42,
        },
        42,
      );
      expect(result).toBe(42);
    });

    it("should execute afterReturning advice even when result is fallback value", async () => {
      const fallbackValue = -555;
      const mockAdvices = createMockAdvices();
      const chainContext = createMockChainContext({ advices: mockAdvices });

      const task = afterReturningAdviceTask(chainContext);
      const result = await task(fallbackValue);

      // afterReturningAdviceTask always executes the advice regardless of result type
      expect(mockAdvices.afterReturning).toHaveBeenCalledTimes(1);
      expect(result).toBe(fallbackValue);
    });
  });

  describe("afterThrowingAdviceTask", () => {
    it("should wait for afterThrowing advice to complete before propagating error", async () => {
      let afterThrowingCompleted = false;
      const mockAdvices = createMockAdvices({
        afterThrowing: jest.fn().mockImplementation(async () => {
          // simulate real async work - use setImmediate to ensure true async behavior
          await new Promise((resolve) => setImmediate(resolve));
          afterThrowingCompleted = true;
        }),
      });
      const chainContext = createMockChainContext({ advices: mockAdvices });

      const task = afterThrowingAdviceTask(chainContext);

      // afterThrowingAdviceTask always throws an error, so handle with catch
      await expect(task(new Error("test"))).rejects.toThrow();

      // verify that afterThrowing completed before the error was thrown
      expect(afterThrowingCompleted).toBe(true);
      expect(mockAdvices.afterThrowing).toHaveBeenCalledTimes(1);
    });

    it("should ensure afterThrowing completes before targetRejection", async () => {
      const executionOrder: string[] = [];

      const mockAdvices = createMockAdvices({
        afterThrowing: jest.fn().mockImplementation(async () => {
          executionOrder.push("afterThrowing-start");
          await new Promise((resolve) => setImmediate(resolve)); // real async work
          executionOrder.push("afterThrowing-end");
        }),
      });
      const chainContext = createMockChainContext({ advices: mockAdvices });

      const task = afterThrowingAdviceTask(chainContext);

      await expect(task(new Error("test"))).rejects.toThrow();

      // error should only occur after afterThrowing has completely finished
      expect(executionOrder).toEqual([
        "afterThrowing-start",
        "afterThrowing-end",
      ]);
    });

    it("should allow afterThrowing to complete its side effects", async () => {
      let sideEffectValue = 0;

      const mockAdvices = createMockAdvices({
        afterThrowing: jest.fn().mockImplementation(async () => {
          // simulate async side effects
          await new Promise((resolve) => setImmediate(resolve));
          sideEffectValue = 42;
        }),
      });
      const chainContext = createMockChainContext({ advices: mockAdvices });

      const task = afterThrowingAdviceTask(chainContext);

      await expect(task(new Error("test"))).rejects.toThrow();

      // verify that side effects have been completed
      expect(sideEffectValue).toBe(42);
      expect(mockAdvices.afterThrowing).toHaveBeenCalledWith(
        { id: "test", data: 42 },
        expect.any(Error),
      );
    });

    it("should propagate correct error type and context", async () => {
      const testError = new Error("custom test error");
      const mockAdvices = createMockAdvices({
        afterThrowing: jest.fn().mockResolvedValue(undefined),
      });
      const chainContext = createMockChainContext({ advices: mockAdvices });

      const task = afterThrowingAdviceTask(chainContext);

      await expect(task(testError)).rejects.toThrow();

      expect(mockAdvices.afterThrowing).toHaveBeenCalledWith(
        { id: "test", data: 42 },
        testError,
      );
    });
  });

  describe("afterAdviceTask", () => {
    it("should execute after advice with correct context", async () => {
      const mockAdvices = createMockAdvices({
        after: jest.fn().mockResolvedValue(undefined),
      });
      const chainContext = createMockChainContext({ advices: mockAdvices });

      const task = afterAdviceTask(chainContext);
      await expect(task()).resolves.toBeUndefined();

      expect(mockAdvices.after).toHaveBeenCalledTimes(1);
      expect(mockAdvices.after).toHaveBeenCalledWith({ id: "test", data: 42 });
    });
  });

  describe("context propagation", () => {
    it("should call context factory for each advice and pass correct context", async () => {
      const testContext = { id: "context-test", data: 999 };
      let contextCallCount = 0;
      const mockAdvices = createMockAdvices();
      const chainContext = createMockChainContext({
        context: () => {
          contextCallCount++;
          return testContext;
        },
        advices: mockAdvices,
      });

      await beforeAdviceTask(chainContext)();
      await afterReturningAdviceTask(chainContext)(42);
      await afterAdviceTask(chainContext)();

      // Context should be called multiple times (once per advice call)
      expect(contextCallCount).toBeGreaterThan(2);
      expect(mockAdvices.before).toHaveBeenCalledWith(testContext);
      expect(mockAdvices.afterReturning).toHaveBeenCalledWith(testContext, 42);
      expect(mockAdvices.after).toHaveBeenCalledWith(testContext);
    });
  });
});
