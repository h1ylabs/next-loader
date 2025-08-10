import {
  createCommonAdvices,
  createCommonTarget,
  createIdDataContext,
  createProcessOptionsMock,
  createThrowingTestTarget,
} from "@/__tests__/test-utils";
import {
  __Props,
  executeAdviceChain,
} from "@/lib/features/chaining/executeAdviceChain";
import { AspectOrganization } from "@/lib/models/aspect";
import {
  defaultBuildOptions,
  RequiredBuildOptions,
} from "@/lib/models/buildOptions";
import { RequiredProcessOptions } from "@/lib/models/processOptions";
import { Target, TARGET_FALLBACK, TargetFallback } from "@/lib/models/target";

describe("executeAdviceChain", () => {
  type TestResult = number;
  type TestSharedContext = {
    readonly id: string;
    readonly data: number;
  };

  const createMockTarget = (value: TestResult): Target<TestResult> =>
    createCommonTarget(value);

  const createErrorTarget = (error: unknown): Target<TestResult> =>
    createThrowingTestTarget<TestResult>(error);

  const createMockContext = (
    id = "test",
    data = 42,
  ): (() => TestSharedContext) => createIdDataContext(id, data);

  const createMockAdvices = (
    overrides: Partial<AspectOrganization<TestResult, TestSharedContext>> = {},
  ): AspectOrganization<TestResult, TestSharedContext> =>
    createCommonAdvices<TestResult, TestSharedContext>(overrides);

  const createMockBuildOptions = (): RequiredBuildOptions =>
    defaultBuildOptions();

  const createMockProcessOptions = (): RequiredProcessOptions<TestResult> =>
    createProcessOptionsMock<TestResult>({
      resolveHaltRejection: jest.fn().mockReturnValue(TARGET_FALLBACK),
    });

  const createTestProps = (
    overrides: Partial<__Props<TestResult, TestSharedContext>> = {},
  ): __Props<TestResult, TestSharedContext> => ({
    target: createMockTarget(100),
    context: createMockContext(),
    advices: createMockAdvices(),
    buildOptions: createMockBuildOptions(),
    processOptions: createMockProcessOptions(),
    ...overrides,
  });

  describe("normal execution flow", () => {
    it("should execute complete advice chain successfully", async () => {
      const mockAdvices = createMockAdvices();
      const props = createTestProps({
        target: createMockTarget(42),
        advices: mockAdvices,
      });

      const result = await executeAdviceChain(props);

      expect(result).toBe(42);
      expect(mockAdvices.before).toHaveBeenCalledTimes(1);
      expect(mockAdvices.around).toHaveBeenCalledTimes(1);
      expect(mockAdvices.afterReturning).toHaveBeenCalledTimes(1);
      expect(mockAdvices.afterThrowing).not.toHaveBeenCalled();
      expect(mockAdvices.after).toHaveBeenCalledTimes(1);
    });

    it("should pass correct context to advice functions", async () => {
      const mockAdvices = createMockAdvices();
      const contextFactory = createMockContext("test-id", 123);
      const props = createTestProps({
        context: contextFactory,
        advices: mockAdvices,
      });

      await executeAdviceChain(props);

      const expectedContext = { id: "test-id", data: 123 };
      expect(mockAdvices.before).toHaveBeenCalledWith(expectedContext);
      expect(mockAdvices.afterReturning).toHaveBeenCalledWith(expectedContext);
      expect(mockAdvices.after).toHaveBeenCalledWith(expectedContext);
    });
  });

  describe("error handling flow", () => {
    it("should execute afterThrowing when target throws error", async () => {
      const targetError = new Error("target failed");
      const mockAdvices = createMockAdvices();
      const props = createTestProps({
        target: createErrorTarget(targetError),
        advices: mockAdvices,
      });

      const result = await executeAdviceChain(props);

      expect(result).toBe(TARGET_FALLBACK);
      expect(mockAdvices.before).toHaveBeenCalledTimes(1);
      expect(mockAdvices.around).toHaveBeenCalledTimes(1);
      expect(mockAdvices.afterReturning).not.toHaveBeenCalled();
      expect(mockAdvices.afterThrowing).toHaveBeenCalledTimes(1);
      expect(mockAdvices.afterThrowing).toHaveBeenCalledWith(
        { id: "test", data: 42 },
        targetError,
      );
      expect(mockAdvices.after).toHaveBeenCalledTimes(1);
    });

    it("should handle errors from advice functions", async () => {
      const beforeError = new Error("before error");
      const mockAdvices = createMockAdvices({
        before: jest.fn().mockRejectedValue(beforeError),
      });

      const mockProcessOptions = createMockProcessOptions();
      const props = createTestProps({
        advices: mockAdvices,
        processOptions: mockProcessOptions,
      });

      const result = await executeAdviceChain(props);

      // Should handle the error and return fallback
      expect(result).toBe(TARGET_FALLBACK);
      expect(mockProcessOptions.resolveHaltRejection).toHaveBeenCalled();
    });
  });

  describe("TARGET_FALLBACK handling", () => {
    it("should skip afterReturning when TARGET_FALLBACK is returned", async () => {
      const mockAdvices = createMockAdvices({
        around: jest.fn().mockImplementation(async (_context, wrap) => {
          wrap(() => TargetFallback);
        }),
      });

      const props = createTestProps({
        advices: mockAdvices,
      });

      const result = await executeAdviceChain(props);

      expect(result).toBe(TARGET_FALLBACK);
      expect(mockAdvices.before).toHaveBeenCalledTimes(1);
      expect(mockAdvices.around).toHaveBeenCalledTimes(1);
      expect(mockAdvices.afterReturning).not.toHaveBeenCalled();
      expect(mockAdvices.after).toHaveBeenCalledTimes(1);
    });
  });

  describe("parallel execution isolation", () => {
    it("should isolate contexts in parallel executions with proper immutable context", async () => {
      const results = await Promise.all([
        executeAdviceChain(
          createTestProps({
            context: () => ({ id: "parallel-1", data: 10 }),
            target: createMockTarget(1),
          }),
        ),
        executeAdviceChain(
          createTestProps({
            context: () => ({ id: "parallel-2", data: 20 }),
            target: createMockTarget(2),
          }),
        ),
        executeAdviceChain(
          createTestProps({
            context: () => ({ id: "parallel-3", data: 30 }),
            target: createMockTarget(3),
          }),
        ),
      ]);

      expect(results).toEqual([1, 2, 3]);
    });
  });

  describe("rejection handling", () => {
    it("should handle continuous rejections", async () => {
      const mockProcessOptions = createMockProcessOptions();
      const mockAdvices = createMockAdvices({
        before: jest.fn().mockRejectedValue(new Error("before error")),
        after: jest.fn().mockRejectedValue(new Error("after error")),
      });

      const props = createTestProps({
        advices: mockAdvices,
        processOptions: mockProcessOptions,
      });

      await executeAdviceChain(props);

      // Should resolve continuous rejections
      expect(mockProcessOptions.resolveContinuousRejection).toHaveBeenCalled();

      // Should resolve halt rejection
      expect(mockProcessOptions.resolveHaltRejection).toHaveBeenCalled();
    });
  });
});
