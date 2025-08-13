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
    > = {}
  ): RequiredProcessOptions<TestResult, TestSharedContext> =>
    createProcessOptionsMock<TestResult, TestSharedContext>({
      resolveHaltRejection: jest
        .fn()
        .mockResolvedValue(() => Promise.resolve(fallbackValue)),
      ...overrides,
    });

  const createMockChainContext = (
    overrides: Partial<AdviceChainContext<TestResult, TestSharedContext>> = {}
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
      const haltRejection = new HaltRejection({
        error: originalError,
        extraInfo: { type: "unknown" },
      });

      const context = createMockChainContext({
        // Use default behavior: rethrow the error
        processOptions: (
          await import("@/lib/models/processOptions")
        ).defaultProcessOptions<number, TestSharedContext>(),
      });
      const chain = () => context;

      const resolver = resolveHaltRejection(chain);
      await expect(resolver(haltRejection)).rejects.toBe(haltRejection);
    });

    it("should resolve HaltRejection using processOptions resolver", async () => {
      const originalError = new Error("original error");
      const haltRejection = new HaltRejection({
        error: originalError,
        extraInfo: { type: "unknown" },
      });
      const fallbackValue = 42;

      const mockProcessOptions = createMockProcessOptions(fallbackValue, {
        resolveHaltRejection: jest
          .fn()
          .mockResolvedValue(() => Promise.resolve(fallbackValue)),
      });

      const context = createMockChainContext({
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const resolver = resolveHaltRejection(chain);
      const result = await resolver(haltRejection);

      expect(mockProcessOptions.resolveHaltRejection).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        haltRejection
      );
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
      expect(mockProcessOptions.resolveHaltRejection).not.toHaveBeenCalled();
    });

    it("should handle resolver that returns a promise", async () => {
      const originalError = new Error("original error");
      const haltRejection = new HaltRejection({
        error: originalError,
        extraInfo: { type: "unknown" },
      });
      const fallbackValue = -888;
      const mockProcessOptions = createMockProcessOptions(fallbackValue, {
        resolveHaltRejection: jest
          .fn()
          .mockResolvedValue(() => Promise.resolve(fallbackValue)),
      });

      const context = createMockChainContext({
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const resolver = resolveHaltRejection(chain);
      const result = await resolver(haltRejection);

      expect(result).toBe(fallbackValue);
      expect(mockProcessOptions.resolveHaltRejection).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        haltRejection
      );
    });

    it("should handle resolver that throws", async () => {
      const originalError = new Error("original error");
      const haltRejection = new HaltRejection({
        error: originalError,
        extraInfo: { type: "unknown" },
      });
      const resolverError = new Error("resolver failed");
      const mockProcessOptions = createMockProcessOptions(-777, {
        resolveHaltRejection: jest.fn().mockImplementation(() => {
          throw resolverError;
        }),
      });

      const context = createMockChainContext({
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const resolver = resolveHaltRejection(chain);

      await expect(resolver(haltRejection)).rejects.toBe(resolverError);
      expect(mockProcessOptions.resolveHaltRejection).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        haltRejection
      );
    });
  });

  describe("handleContinuousRejection", () => {
    it("should process continuous rejections using processOptions resolver", async () => {
      const error1 = new Error("error 1");
      const error2 = new Error("error 2");
      const continuousRejections = [
        new ContinuousRejection({
          error: error1,
          extraInfo: { type: "unknown" },
        }),
        new ContinuousRejection({
          error: error2,
          extraInfo: { type: "unknown" },
        }),
      ];

      const mockProcessOptions = createMockProcessOptions();
      const context = createMockChainContext({
        continueRejections: continuousRejections,
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const handler = handleContinuousRejection(chain);
      await handler();

      expect(
        mockProcessOptions.resolveContinuousRejection
      ).toHaveBeenCalledTimes(1);
      expect(
        mockProcessOptions.resolveContinuousRejection
      ).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        continuousRejections
      );
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
        mockProcessOptions.resolveContinuousRejection
      ).toHaveBeenCalledTimes(1);
      expect(
        mockProcessOptions.resolveContinuousRejection
      ).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), []);
    });

    it("should handle single continuous rejection", async () => {
      const singleError = new Error("single error");
      const continuousRejection = new ContinuousRejection({
        error: singleError,
        extraInfo: { type: "unknown" },
      });

      const mockProcessOptions = createMockProcessOptions();
      const context = createMockChainContext({
        continueRejections: [continuousRejection],
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const handler = handleContinuousRejection(chain);
      await handler();

      expect(
        mockProcessOptions.resolveContinuousRejection
      ).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), [
        continuousRejection,
      ]);
    });

    it("should handle resolver that throws", async () => {
      const error1 = new Error("error 1");
      const resolverError = new Error("resolver failed");

      const mockProcessOptions = createMockProcessOptions(-777, {
        resolveContinuousRejection: jest.fn().mockRejectedValue(resolverError),
      });

      const continuousRejection = new ContinuousRejection({
        error: error1,
        extraInfo: { type: "unknown" },
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
        resolveContinuousRejection: jest.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return "resolved";
        }),
      });

      const continuousRejection = new ContinuousRejection({
        error: error1,
        extraInfo: { type: "unknown" },
      });
      const context = createMockChainContext({
        continueRejections: [continuousRejection],
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const handler = handleContinuousRejection(chain);
      await handler();

      expect(
        mockProcessOptions.resolveContinuousRejection
      ).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), [
        continuousRejection,
      ]);
    });
  });

  describe("integration scenarios", () => {
    it("should work together in typical error resolution flow", async () => {
      const continueError = new Error("continue error");
      const fallbackValue = -666;

      const mockProcessOptions = createMockProcessOptions(fallbackValue, {
        resolveHaltRejection: jest
          .fn()
          .mockResolvedValue(() => Promise.resolve(fallbackValue)),
      });

      const continuousRejection = new ContinuousRejection({
        error: continueError,
        extraInfo: { type: "unknown" },
      });
      const context = createMockChainContext({
        continueRejections: [continuousRejection],
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      // First handle continuous rejections
      const continuousHandler = handleContinuousRejection(chain);
      await continuousHandler();

      expect(
        mockProcessOptions.resolveContinuousRejection
      ).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), [
        continuousRejection,
      ]);

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
        new ContinuousRejection({
          error: regularError,
          extraInfo: { type: "unknown" },
        }),
        new ContinuousRejection({
          error: stringError,
          extraInfo: { type: "unknown" },
        }),
        new ContinuousRejection({
          error: objectError,
          extraInfo: { type: "unknown" },
        }),
      ];

      const mockProcessOptions = createMockProcessOptions();
      const context = createMockChainContext({
        continueRejections: mixedRejections,
        processOptions: mockProcessOptions,
      });
      const chain = () => context;

      const handler = handleContinuousRejection(chain);
      await handler();

      expect(
        mockProcessOptions.resolveContinuousRejection
      ).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        mixedRejections
      );
    });
  });
});
