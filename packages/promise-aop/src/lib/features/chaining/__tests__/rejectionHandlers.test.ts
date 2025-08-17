import {
  createCommonAdvices as __createMockAdvices,
  createCommonTarget as __createMockTarget,
  createIdDataContext,
  createProcessOptionsMock,
} from "@/__tests__/test-utils";
import { AdviceChainContext } from "@/lib/features/chaining/context";
import {
  handleContinuousRejection,
  resolveHaltRejection,
} from "@/lib/features/chaining/rejectionHandlers";
import { AspectOrganization } from "@/lib/models/aspect";
import {
  defaultBuildOptions,
  RequiredBuildOptions,
} from "@/lib/models/buildOptions";
import { RequiredProcessOptions } from "@/lib/models/processOptions";
import { ContinuousRejection, HaltRejection } from "@/lib/models/rejection";
import { Target } from "@/lib/models/target";

describe("rejectionHandlers", () => {
  type TestResult = number;
  type TestSharedContext = {
    readonly id: string;
    readonly data: number;
  };

  const createMockTarget = (value: TestResult): Target<TestResult> =>
    __createMockTarget(value);

  const createMockContext = (): (() => TestSharedContext) =>
    createIdDataContext("test", 42);

  const createMockAdvices = (): AspectOrganization<
    TestResult,
    TestSharedContext
  > => __createMockAdvices<TestResult, TestSharedContext>();

  const createMockBuildOptions = (): RequiredBuildOptions =>
    defaultBuildOptions();

  const createMockProcessOptions = (
    fallbackValue: TestResult = -999,
    overrides: Partial<
      RequiredProcessOptions<TestResult, TestSharedContext>
    > = {},
  ): RequiredProcessOptions<TestResult, TestSharedContext> =>
    createProcessOptionsMock<TestResult, TestSharedContext>({
      handleError: jest.fn().mockResolvedValue(fallbackValue),
      ...overrides,
    });

  const createMockChainContext = (
    overrides: Partial<AdviceChainContext<TestResult, TestSharedContext>> = {},
  ): AdviceChainContext<TestResult, TestSharedContext> => ({
    target: createMockTarget(100),
    context: createMockContext(),
    exit: <T>(callback: () => T) => callback(),
    advices: createMockAdvices(),
    buildOptions: createMockBuildOptions(),
    processOptions: createMockProcessOptions(),
    continueRejections: [],
    ...overrides,
  });

  describe("resolveHaltRejection", () => {
    it("should propagate original error when using default process options", async () => {
      const originalError = new Error("original error");
      const haltRejection = new HaltRejection([originalError], {
        occurredFrom: "unknown",
      });

      const context = createMockChainContext({
        // Use default behavior: rethrow the error
        processOptions: (
          await import("@/lib/models/processOptions")
        ).defaultProcessOptions<number, TestSharedContext>(),
      });
      const chain = () => context;

      const resolver = resolveHaltRejection(chain);
      await expect(resolver(haltRejection)).rejects.toBe(
        haltRejection.errors[0],
      );
    });

    it("should resolve HaltRejection using processOptions resolver", async () => {
      const originalError = new Error("original error");
      const haltRejection = new HaltRejection([originalError], {
        occurredFrom: "unknown",
      });
      const fallbackValue = 42;

      const mockProcessOptions = createMockProcessOptions(fallbackValue, {
        handleError: jest.fn().mockResolvedValue(fallbackValue),
      });

      const context = createMockChainContext({
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const resolver = resolveHaltRejection(chain);
      const result = await resolver(haltRejection);

      expect(mockProcessOptions.handleError).toHaveBeenCalledWith({
        context: expect.any(Function),
        exit: expect.any(Function),
        error: haltRejection.errors[0],
      });
      expect(result).toBe(fallbackValue);
    });

    it("should throw non-HaltRejection without processing", async () => {
      const regularError = new Error("regular error");
      const mockProcessOptions = createMockProcessOptions();

      const context = createMockChainContext({
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const resolver = resolveHaltRejection(chain);

      await expect(resolver(regularError)).rejects.toBe(regularError);
      expect(mockProcessOptions.handleError).not.toHaveBeenCalled();
    });

    it("should handle resolver that returns a promise", async () => {
      const originalError = new Error("original error");
      const haltRejection = new HaltRejection([originalError], {
        occurredFrom: "unknown",
      });
      const fallbackValue = -888;
      const mockProcessOptions = createMockProcessOptions(fallbackValue, {
        handleError: jest.fn().mockResolvedValue(fallbackValue),
      });

      const context = createMockChainContext({
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const resolver = resolveHaltRejection(chain);
      const result = await resolver(haltRejection);

      expect(result).toBe(fallbackValue);
      expect(mockProcessOptions.handleError).toHaveBeenCalledWith({
        context: expect.any(Function),
        exit: expect.any(Function),
        error: haltRejection.errors[0],
      });
    });

    it("should handle resolver that throws", async () => {
      const originalError = new Error("original error");
      const haltRejection = new HaltRejection([originalError], {
        occurredFrom: "unknown",
      });
      const resolverError = new Error("resolver failed");
      const mockProcessOptions = createMockProcessOptions(-777, {
        handleError: jest.fn().mockImplementation(() => {
          throw resolverError;
        }),
      });

      const context = createMockChainContext({
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const resolver = resolveHaltRejection(chain);

      await expect(resolver(haltRejection)).rejects.toBe(resolverError);
      expect(mockProcessOptions.handleError).toHaveBeenCalledWith({
        context: expect.any(Function),
        exit: expect.any(Function),
        error: haltRejection.errors[0],
      });
    });

    it("should select an error using determineError and pass it to handleError", async () => {
      const error1 = new Error("error 1");
      const error2 = new Error("error 2");
      const haltRejection = new HaltRejection([error1, error2], {
        occurredFrom: "unknown",
      });
      const fallbackValue = 999;

      const mockProcessOptions = createMockProcessOptions(fallbackValue, {
        determineError: jest.fn().mockImplementation(async ({ errors }) => {
          return errors[1];
        }),
      });

      const context = createMockChainContext({
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const resolver = resolveHaltRejection(chain);
      await resolver(haltRejection);

      expect(mockProcessOptions.determineError).toHaveBeenCalledWith({
        context: expect.any(Function),
        exit: expect.any(Function),
        errors: haltRejection.errors,
        info: haltRejection.info,
      });

      expect(mockProcessOptions.handleError).toHaveBeenCalledWith({
        context: expect.any(Function),
        exit: expect.any(Function),
        error: error2,
      });
    });
  });

  describe("handleContinuousRejection", () => {
    it("should process continuous rejections using processOptions resolver", async () => {
      const error1 = new Error("error 1");
      const error2 = new Error("error 2");
      const continuousRejections = [
        new ContinuousRejection([error1], { occurredFrom: "unknown" }),
        new ContinuousRejection([error2], { occurredFrom: "unknown" }),
      ];

      const mockProcessOptions = createMockProcessOptions();
      const context = createMockChainContext({
        continueRejections: continuousRejections,
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const handler = handleContinuousRejection(chain);
      await handler();

      expect(mockProcessOptions.handleContinuedErrors).toHaveBeenCalledTimes(1);
      expect(mockProcessOptions.handleContinuedErrors).toHaveBeenCalledWith({
        context: expect.any(Function),
        exit: expect.any(Function),
        errors: continuousRejections.map((r) => [r.errors, r.info]),
      });
    });

    it("should handle empty continuous rejections array", async () => {
      const mockProcessOptions = createMockProcessOptions();
      const context = createMockChainContext({
        continueRejections: [],
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const handler = handleContinuousRejection(chain);
      await handler();

      expect(mockProcessOptions.handleContinuedErrors).toHaveBeenCalledTimes(1);
      expect(mockProcessOptions.handleContinuedErrors).toHaveBeenCalledWith({
        context: expect.any(Function),
        exit: expect.any(Function),
        errors: [],
      });
    });

    it("should handle single continuous rejection", async () => {
      const singleError = new Error("single error");
      const continuousRejection = new ContinuousRejection([singleError], {
        occurredFrom: "unknown",
      });

      const mockProcessOptions = createMockProcessOptions();
      const context = createMockChainContext({
        continueRejections: [continuousRejection],
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const handler = handleContinuousRejection(chain);
      await handler();

      expect(mockProcessOptions.handleContinuedErrors).toHaveBeenCalledWith({
        context: expect.any(Function),
        exit: expect.any(Function),
        errors: [[continuousRejection.errors, continuousRejection.info]],
      });
    });

    it("should handle resolver that throws", async () => {
      const error1 = new Error("error 1");
      const resolverError = new Error("resolver failed");

      const mockProcessOptions = createMockProcessOptions(-777, {
        handleContinuedErrors: jest.fn().mockRejectedValue(resolverError),
      });

      const continuousRejection = new ContinuousRejection([error1], {
        occurredFrom: "unknown",
      });
      const context = createMockChainContext({
        continueRejections: [continuousRejection],
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const handler = handleContinuousRejection(chain);

      await expect(handler()).rejects.toBe(resolverError);
    });

    it("should handle async resolver", async () => {
      const error1 = new Error("error 1");
      const mockProcessOptions = createMockProcessOptions(-666, {
        handleContinuedErrors: jest.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return "resolved";
        }),
      });

      const continuousRejection = new ContinuousRejection([error1], {
        occurredFrom: "unknown",
      });
      const context = createMockChainContext({
        continueRejections: [continuousRejection],
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const handler = handleContinuousRejection(chain);
      await handler();

      expect(mockProcessOptions.handleContinuedErrors).toHaveBeenCalledWith({
        context: expect.any(Function),
        exit: expect.any(Function),
        errors: [[continuousRejection.errors, continuousRejection.info]],
      });
    });
  });

  describe("integration scenarios", () => {
    it("should work together in typical error resolution flow", async () => {
      const continueError = new Error("continue error");
      const fallbackValue = -666;

      const mockProcessOptions = createMockProcessOptions(fallbackValue, {
        handleError: jest.fn().mockResolvedValue(fallbackValue),
      });

      const continuousRejection = new ContinuousRejection([continueError], {
        occurredFrom: "unknown",
      });
      const context = createMockChainContext({
        continueRejections: [continuousRejection],
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      // First handle continuous rejections
      const continuousHandler = handleContinuousRejection(chain);
      await continuousHandler();

      expect(mockProcessOptions.handleContinuedErrors).toHaveBeenCalledWith({
        context: expect.any(Function),
        exit: expect.any(Function),
        errors: [[continuousRejection.errors, continuousRejection.info]],
      });

      // Then test rejection handling with regular error
      const haltResolver = resolveHaltRejection(chain);
      const regularError = new Error("regular error");

      await expect(haltResolver(regularError)).rejects.toBe(regularError);
    });

    it("should handle complex rejection arrays with mixed types", async () => {
      const regularError = new Error("regular error");
      const stringError = "string error";
      const objectError = { code: 500, message: "object error" };
      const mixedRejections = [
        new ContinuousRejection([regularError], { occurredFrom: "unknown" }),
        new ContinuousRejection([stringError], { occurredFrom: "unknown" }),
        new ContinuousRejection([objectError], { occurredFrom: "unknown" }),
      ];

      const mockProcessOptions = createMockProcessOptions();
      const context = createMockChainContext({
        continueRejections: mixedRejections,
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const handler = handleContinuousRejection(chain);
      await handler();

      expect(mockProcessOptions.handleContinuedErrors).toHaveBeenCalledWith({
        context: expect.any(Function),
        exit: expect.any(Function),
        errors: mixedRejections.map((r) => [r.errors, r.info]),
      });
    });
  });
});
