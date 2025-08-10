import {
  createCommonAdvices as __createMockAdvices,
  createCommonTarget as __createMockTarget,
  createIdDataContext,
  createProcessOptionsMock,
} from "@/__tests__/test-utils";
import { HaltError } from "@/lib/errors/HaltError";
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
import { Target, TARGET_FALLBACK } from "@/lib/models/target";

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
    overrides: Partial<RequiredProcessOptions<TestResult>> = {},
  ): RequiredProcessOptions<TestResult> =>
    createProcessOptionsMock<TestResult>({
      resolveHaltRejection: jest.fn().mockReturnValue(TARGET_FALLBACK),
      ...overrides,
    });

  const createMockChainContext = (
    overrides: Partial<AdviceChainContext<TestResult, TestSharedContext>> = {},
  ): AdviceChainContext<TestResult, TestSharedContext> => ({
    target: createMockTarget(100),
    context: createMockContext(),
    advices: createMockAdvices(),
    buildOptions: createMockBuildOptions(),
    processOptions: createMockProcessOptions(),
    continueRejections: [],
    ...overrides,
  });

  describe("resolveHaltRejection", () => {
    it("should resolve HaltError using processOptions resolver", async () => {
      const originalError = new Error("original error");
      const haltError = new HaltError(originalError);

      const mockProcessOptions = createMockProcessOptions({
        resolveHaltRejection: jest.fn().mockReturnValue(42),
      });

      const context = createMockChainContext({
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const resolver = resolveHaltRejection(chain);
      const result = await resolver(haltError);

      expect(mockProcessOptions.resolveHaltRejection).toHaveBeenCalledWith(
        haltError,
      );
      expect(result).toBe(42);
    });

    it("should throw non-HaltError without processing", async () => {
      const regularError = new Error("regular error");
      const mockProcessOptions = createMockProcessOptions();

      const context = createMockChainContext({
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const resolver = resolveHaltRejection(chain);

      await expect(resolver(regularError)).rejects.toBe(regularError);
      expect(mockProcessOptions.resolveHaltRejection).not.toHaveBeenCalled();
    });

    it("should handle resolver that returns a promise", async () => {
      const originalError = new Error("original error");
      const haltError = new HaltError(originalError);
      const mockProcessOptions = createMockProcessOptions({
        resolveHaltRejection: jest.fn().mockResolvedValue(TARGET_FALLBACK),
      });

      const context = createMockChainContext({
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const resolver = resolveHaltRejection(chain);
      const result = await resolver(haltError);

      expect(result).toBe(TARGET_FALLBACK);
      expect(mockProcessOptions.resolveHaltRejection).toHaveBeenCalledWith(
        haltError,
      );
    });

    it("should handle resolver that throws", async () => {
      const originalError = new Error("original error");
      const haltError = new HaltError(originalError);
      const resolverError = new Error("resolver failed");
      const mockProcessOptions = createMockProcessOptions({
        resolveHaltRejection: jest.fn().mockImplementation(() => {
          throw resolverError;
        }),
      });

      const context = createMockChainContext({
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const resolver = resolveHaltRejection(chain);

      await expect(resolver(haltError)).rejects.toBe(resolverError);
      expect(mockProcessOptions.resolveHaltRejection).toHaveBeenCalledWith(
        haltError,
      );
    });
  });

  describe("handleContinuousRejection", () => {
    it("should process continuous rejections using processOptions resolver", async () => {
      const error1 = new Error("error 1");
      const error2 = new Error("error 2");
      const continueRejections = [error1, error2];

      const mockProcessOptions = createMockProcessOptions();
      const context = createMockChainContext({
        continueRejections,
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const handler = handleContinuousRejection(chain);
      await handler();

      expect(
        mockProcessOptions.resolveContinuousRejection,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockProcessOptions.resolveContinuousRejection,
      ).toHaveBeenCalledWith(continueRejections);
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

      expect(
        mockProcessOptions.resolveContinuousRejection,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockProcessOptions.resolveContinuousRejection,
      ).toHaveBeenCalledWith([]);
    });

    it("should handle single continuous rejection", async () => {
      const singleError = new Error("single error");
      const continueRejections = [singleError];

      const mockProcessOptions = createMockProcessOptions();
      const context = createMockChainContext({
        continueRejections,
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const handler = handleContinuousRejection(chain);
      await handler();

      expect(
        mockProcessOptions.resolveContinuousRejection,
      ).toHaveBeenCalledWith([singleError]);
    });

    it("should handle resolver that throws", async () => {
      const error1 = new Error("error 1");
      const resolverError = new Error("resolver failed");

      const mockProcessOptions = createMockProcessOptions({
        resolveContinuousRejection: jest.fn().mockImplementation(() => {
          throw resolverError;
        }),
      });

      const context = createMockChainContext({
        continueRejections: [error1],
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const handler = handleContinuousRejection(chain);

      await expect(handler()).rejects.toBe(resolverError);
    });

    it("should handle async resolver", async () => {
      const error1 = new Error("error 1");
      const mockProcessOptions = createMockProcessOptions({
        resolveContinuousRejection: jest.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return "resolved";
        }),
      });

      const context = createMockChainContext({
        continueRejections: [error1],
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const handler = handleContinuousRejection(chain);
      await handler();

      expect(
        mockProcessOptions.resolveContinuousRejection,
      ).toHaveBeenCalledWith([error1]);
    });
  });

  describe("integration scenarios", () => {
    it("should work together in typical error resolution flow", async () => {
      const continueError = new Error("continue error");

      const mockProcessOptions = createMockProcessOptions({
        resolveHaltRejection: jest.fn().mockReturnValue(TARGET_FALLBACK),
      });

      const context = createMockChainContext({
        continueRejections: [continueError],
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      // First handle continuous rejections
      const continuousHandler = handleContinuousRejection(chain);
      await continuousHandler();

      expect(
        mockProcessOptions.resolveContinuousRejection,
      ).toHaveBeenCalledWith([continueError]);

      // Then test rejection handling with regular error
      const haltResolver = resolveHaltRejection(chain);
      const regularError = new Error("regular error");

      await expect(haltResolver(regularError)).rejects.toBe(regularError);
    });

    it("should handle complex rejection arrays with mixed types", async () => {
      const regularError = new Error("regular error");
      const stringError = "string error";
      const objectError = { code: 500, message: "object error" };
      const mixedRejections = [regularError, stringError, objectError];

      const mockProcessOptions = createMockProcessOptions();
      const context = createMockChainContext({
        continueRejections: mixedRejections,
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const handler = handleContinuousRejection(chain);
      await handler();

      expect(
        mockProcessOptions.resolveContinuousRejection,
      ).toHaveBeenCalledWith(mixedRejections);
    });
  });
});
