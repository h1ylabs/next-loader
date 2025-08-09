/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  __Props,
  __Return,
  processAroundAdvice,
} from "@/lib/features/processing/processAroundAdvice";
import { AdviceFunctionWithContext } from "@/lib/models/advice";
import { TargetWrapper } from "@/lib/models/target";

describe("processAroundAdvice", () => {
  type TestSharedContext = {
    readonly value: number;
    readonly flag: boolean;
  };

  type TestResult = number;

  const createMockTarget = (value: TestResult) => async () => value;

  const createTestProps = (
    around: AdviceFunctionWithContext<TestResult, TestSharedContext, "around">,
  ): __Props<TestResult, TestSharedContext> => ({
    context: { value: 10, flag: true },
    around,
  });

  describe("with no wrappers", () => {
    it("should return identity wrapper when no wrappers are pushed", async () => {
      const around: AdviceFunctionWithContext<
        TestResult,
        TestSharedContext,
        "around"
      > = async () => {
        // Push no wrappers
      };

      const props = createTestProps(around);
      const resultWrapper = await processAroundAdvice(props);

      const mockTarget = createMockTarget(42);
      const wrappedTarget = resultWrapper(mockTarget);
      const result = await wrappedTarget();

      expect(result).toBe(42);
    });
  });

  describe("with single wrapper", () => {
    it("should apply single wrapper correctly", async () => {
      const singleWrapper: TargetWrapper<TestResult> = (target) => async () => {
        const result = await target();
        return result + 1;
      };

      const around: AdviceFunctionWithContext<
        TestResult,
        TestSharedContext,
        "around"
      > = async (_context, wrap) => {
        wrap(singleWrapper);
      };

      const props = createTestProps(around);
      const resultWrapper = await processAroundAdvice(props);

      const mockTarget = createMockTarget(10);
      const wrappedTarget = resultWrapper(mockTarget);
      const result = await wrappedTarget();

      expect(result).toBe(11);
    });
  });

  describe("with multiple wrappers", () => {
    it("should apply wrappers in correct order (first pushed applied innermost)", async () => {
      const addOne: TargetWrapper<TestResult> = (target) => async () => {
        const result = await target();
        return result + 1;
      };

      const multiplyByTwo: TargetWrapper<TestResult> = (target) => async () => {
        const result = await target();
        return result * 2;
      };

      const around: AdviceFunctionWithContext<
        TestResult,
        TestSharedContext,
        "around"
      > = async (_context, wrap) => {
        wrap(addOne); // First pushed (applied innermost)
        wrap(multiplyByTwo); // Second pushed (applied outermost)
      };

      const props = createTestProps(around);
      const resultWrapper: __Return<TestResult> =
        await processAroundAdvice(props);

      const mockTarget = createMockTarget(5);
      const wrappedTarget = resultWrapper(mockTarget);
      const result = await wrappedTarget();

      // Execution order: multiplyByTwo(addOne(target))
      // addOne(5) = 6, then multiplyByTwo(6) = 12
      expect(result).toBe(12);
    });

    it("should handle three wrappers with proper composition", async () => {
      const addOne: TargetWrapper<TestResult> = (target) => async () => {
        const result = await target();
        return result + 1;
      };

      const multiplyByTwo: TargetWrapper<TestResult> = (target) => async () => {
        const result = await target();
        return result * 2;
      };

      const addTen: TargetWrapper<TestResult> = (target) => async () => {
        const result = await target();
        return result + 10;
      };

      const around: AdviceFunctionWithContext<
        TestResult,
        TestSharedContext,
        "around"
      > = async (_context, wrap) => {
        wrap(addOne); // First pushed (applied innermost)
        wrap(multiplyByTwo); // Second pushed (applied middle)
        wrap(addTen); // Third pushed (applied outermost)
      };

      const props = createTestProps(around);
      const resultWrapper: __Return<TestResult> =
        await processAroundAdvice(props);

      const mockTarget = createMockTarget(2);
      const wrappedTarget = resultWrapper(mockTarget);
      const result = await wrappedTarget();

      // Execution order: addTen(multiplyByTwo(addOne(target)))
      // addOne(2) = 3, then multiplyByTwo(3) = 6, then addTen(6) = 16
      expect(result).toBe(16);
    });
  });

  describe("with async around advice", () => {
    it("should handle async around advice that takes time", async () => {
      const delayWrapper: TargetWrapper<TestResult> = (target) => async () => {
        const result = await target();
        return result + 100;
      };

      const around: AdviceFunctionWithContext<
        TestResult,
        TestSharedContext,
        "around"
      > = async (_context, wrap) => {
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 10));
        wrap(delayWrapper);
      };

      const props = createTestProps(around);
      const resultWrapper: __Return<TestResult> =
        await processAroundAdvice(props);

      const mockTarget = createMockTarget(50);
      const wrappedTarget = resultWrapper(mockTarget);
      const result = await wrappedTarget();

      expect(result).toBe(150);
    });
  });

  describe("with context usage", () => {
    it("should pass context correctly to around advice", async () => {
      let capturedContext: TestSharedContext | undefined;

      const contextAwareWrapper: TargetWrapper<TestResult> =
        (target) => async () => {
          const result = await target();
          return result + (capturedContext?.value ?? 0);
        };

      const around: AdviceFunctionWithContext<
        TestResult,
        TestSharedContext,
        "around"
      > = async (context, wrap) => {
        capturedContext = context;
        wrap(contextAwareWrapper);
      };

      const props = createTestProps(around);
      const resultWrapper: __Return<TestResult> =
        await processAroundAdvice(props);

      const mockTarget = createMockTarget(5);
      const wrappedTarget = resultWrapper(mockTarget);
      const result = await wrappedTarget();

      expect(capturedContext).toEqual({ value: 10, flag: true });
      expect(result).toBe(15); // 5 + 10
    });
  });

  describe("edge cases", () => {
    it("should handle wrappers that throw errors", async () => {
      const errorWrapper: TargetWrapper<TestResult> = (_target) => async () => {
        throw new Error("Wrapper error");
      };

      const around: AdviceFunctionWithContext<
        TestResult,
        TestSharedContext,
        "around"
      > = async (_context, wrap) => {
        wrap(errorWrapper);
      };

      const props = createTestProps(around);
      const resultWrapper: __Return<TestResult> =
        await processAroundAdvice(props);

      const mockTarget = createMockTarget(10);
      const wrappedTarget = resultWrapper(mockTarget);

      await expect(wrappedTarget()).rejects.toThrow("Wrapper error");
    });

    it("should handle wrapper that modifies target behavior completely", async () => {
      const replacementWrapper: TargetWrapper<TestResult> =
        (_target) => async () => {
          // Completely ignore original target
          return 999;
        };

      const around: AdviceFunctionWithContext<
        TestResult,
        TestSharedContext,
        "around"
      > = async (_context, wrap) => {
        wrap(replacementWrapper);
      };

      const props = createTestProps(around);
      const resultWrapper: __Return<TestResult> =
        await processAroundAdvice(props);

      const mockTarget = createMockTarget(10);
      const wrappedTarget = resultWrapper(mockTarget);
      const result = await wrappedTarget();

      expect(result).toBe(999);
    });
  });
});
