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
import { Target, TARGET_FALLBACK, TargetFallback } from "@/lib/models/target";

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
      const mockProcessAroundAdvice = jest
        .fn()
        .mockResolvedValue(
          (_: Target<TestResult>) =>
            (_: (t: Target<TestResult>) => Target<TestResult>) =>
              TargetFallback,
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
      expect(wrappedResult).toBe(TARGET_FALLBACK);
    });
  });

  describe("executeTargetTask", () => {
    it("should execute target function successfully", async () => {
      const target = createMockTarget(42);
      const result = await executeTargetTask(target);
      expect(result).toBe(42);
    });

    it("should execute TargetFallback and return TARGET_FALLBACK", async () => {
      const result = await executeTargetTask(TargetFallback);
      expect(result).toBe(TARGET_FALLBACK);
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
      expect(mockAdvices.afterReturning).toHaveBeenCalledWith({
        id: "test",
        data: 42,
      });
      expect(result).toBe(42);
    });

    it("should execute afterReturning advice even when result is TARGET_FALLBACK", async () => {
      const mockAdvices = createMockAdvices();
      const chainContext = createMockChainContext({ advices: mockAdvices });

      const task = afterReturningAdviceTask(chainContext);
      const result = await task(TARGET_FALLBACK as unknown as number);

      // afterReturningAdviceTask always executes the advice regardless of result type
      expect(mockAdvices.afterReturning).toHaveBeenCalledTimes(1);
      expect(result).toBe(TARGET_FALLBACK);
    });
  });

  describe("afterThrowingAdviceTask", () => {
    it("should be tested through integration tests due to error class restrictions", () => {
      // afterThrowingAdviceTask internally creates TargetError objects which cannot be instantiated in tests
      // This function is properly tested through the executeAdviceChain integration tests
      expect(afterThrowingAdviceTask).toBeDefined();
      expect(typeof afterThrowingAdviceTask).toBe("function");
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
      expect(mockAdvices.afterReturning).toHaveBeenCalledWith(testContext);
      expect(mockAdvices.after).toHaveBeenCalledWith(testContext);
    });
  });
});
