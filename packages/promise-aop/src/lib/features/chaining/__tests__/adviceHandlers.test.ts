import {
  createCommonAdvices,
  createCommonTarget,
  createIdDataContext,
  createProcessOptionsMock,
} from "@/__tests__/test-utils";
import { AdviceError } from "@/lib/errors/AdviceError";
import { HaltError } from "@/lib/errors/HaltError";
import { TargetError } from "@/lib/errors/TargetError";
import { UnknownError } from "@/lib/errors/UnknownError";
import {
  checkRejection,
  handleRejection,
} from "@/lib/features/chaining/adviceHandlers";
import { AdviceChainContext } from "@/lib/features/chaining/context";
import { AspectOrganization } from "@/lib/models/aspect";
import {
  defaultBuildOptions,
  RequiredBuildOptions,
} from "@/lib/models/buildOptions";
import { RequiredProcessOptions } from "@/lib/models/processOptions";
import { Target } from "@/lib/models/target";

describe("adviceHandlers", () => {
  type TestResult = number;
  type TestSharedContext = {
    readonly id: string;
    readonly data: number;
  };

  const createMockTarget = (value: TestResult): Target<TestResult> =>
    createCommonTarget(value);

  const createMockContext = (): (() => TestSharedContext) =>
    createIdDataContext("test", 42);

  const createMockAdvices = (): AspectOrganization<
    TestResult,
    TestSharedContext
  > => createCommonAdvices<TestResult, TestSharedContext>();

  const createMockBuildOptions = (): RequiredBuildOptions =>
    defaultBuildOptions();

  const createMockProcessOptions = (): RequiredProcessOptions<TestResult> =>
    createProcessOptionsMock<TestResult>();

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

  describe("checkRejection", () => {
    it("should do nothing when haltRejection is undefined", async () => {
      const context = createMockChainContext();
      const chain = () => context;

      const checkTask = checkRejection(chain);

      await expect(checkTask()).resolves.toBeUndefined();
    });

    it("should throw haltRejection when it exists", async () => {
      const haltError = new HaltError(new Error("halted"));
      const context = createMockChainContext({
        haltRejection: haltError,
      });
      const chain = () => context;

      const checkTask = checkRejection(chain);

      await expect(checkTask()).rejects.toBe(haltError);
    });
  });

  describe("handleRejection", () => {
    it("should propagate HaltError without modification", async () => {
      const haltError = new HaltError(new Error("already halted"));
      const context = createMockChainContext();
      const chain = () => context;

      const handleTask = handleRejection(chain);

      await expect(handleTask(haltError)).rejects.toBe(haltError);
      expect(context.haltRejection).toBeUndefined();
      expect(context.continueRejections).toHaveLength(0);
    });

    describe("AdviceError handling", () => {
      it("should handle AdviceError with halt strategy", async () => {
        const adviceError = new AdviceError("before", ["test error"]);

        const buildOptions = createMockBuildOptions();

        const context = createMockChainContext({ buildOptions });
        const chain = () => context;

        const handleTask = handleRejection(chain);

        // This should set haltRejection and then throw it
        await expect(handleTask(adviceError)).rejects.toBeInstanceOf(HaltError);
        expect(context.haltRejection).toBeInstanceOf(HaltError);
        expect(context.haltRejection?.cause).toBe(adviceError);
        expect(context.continueRejections).toHaveLength(0);
      });

      it("should handle AdviceError with continue strategy", async () => {
        const adviceError = new AdviceError("after", ["test error"]);

        const buildOptions = createMockBuildOptions();

        const context = createMockChainContext({ buildOptions });
        const chain = () => context;

        const handleTask = handleRejection(chain);
        await handleTask(adviceError);

        expect(context.haltRejection).toBeUndefined();
        expect(context.continueRejections).toContain(adviceError);
        expect(context.continueRejections).toHaveLength(1);
      });
    });

    it("should convert TargetError to HaltError immediately", async () => {
      const targetError = new TargetError(new Error("target failed"));
      const context = createMockChainContext();
      const chain = () => context;

      const handleTask = handleRejection(chain);
      await expect(handleTask(targetError)).rejects.toBeInstanceOf(HaltError);

      expect(context.haltRejection).toBeInstanceOf(HaltError);
      expect(context.haltRejection?.cause).toBe(targetError);
      expect(context.continueRejections).toHaveLength(0);
    });

    it("should wrap unknown error in UnknownError then HaltError", async () => {
      const unknownError = new Error("unknown error");
      const context = createMockChainContext();
      const chain = () => context;

      const handleTask = handleRejection(chain);
      await expect(handleTask(unknownError)).rejects.toBeInstanceOf(HaltError);

      expect(context.haltRejection).toBeInstanceOf(HaltError);
      expect(context.haltRejection?.cause).toBeInstanceOf(UnknownError);
      expect((context.haltRejection?.cause as UnknownError).cause).toBe(
        unknownError,
      );
      expect(context.continueRejections).toHaveLength(0);
    });

    it("should handle string errors by wrapping in UnknownError then HaltError", async () => {
      const stringError = "string error";
      const context = createMockChainContext();
      const chain = () => context;

      const handleTask = handleRejection(chain);
      await expect(handleTask(stringError)).rejects.toBeInstanceOf(HaltError);

      expect(context.haltRejection).toBeInstanceOf(HaltError);
      expect(context.haltRejection?.cause).toBeInstanceOf(UnknownError);
      expect((context.haltRejection?.cause as UnknownError).cause).toBe(
        stringError,
      );
    });

    it("should handle null errors by wrapping in UnknownError then HaltError", async () => {
      const context = createMockChainContext();
      const chain = () => context;

      const handleTask = handleRejection(chain);
      await expect(handleTask(null)).rejects.toBeInstanceOf(HaltError);

      expect(context.haltRejection).toBeInstanceOf(HaltError);
      expect(context.haltRejection?.cause).toBeInstanceOf(UnknownError);
      expect((context.haltRejection?.cause as UnknownError).cause).toBeNull();
    });
  });

  describe("integration scenarios", () => {
    it("should handle mixed error types in sequence", async () => {
      const continueError = new AdviceError("after", ["continue error"]);
      const haltError = new AdviceError("before", ["halt error"]);

      const buildOptions = createMockBuildOptions();

      const context = createMockChainContext({ buildOptions });
      const chain = () => context;
      const handleTask = handleRejection(chain);

      // First handle continue error
      await handleTask(continueError);
      expect(context.continueRejections).toContain(continueError);
      expect(context.haltRejection).toBeUndefined();

      // Then handle halt error - should set haltRejection and throw
      await expect(handleTask(haltError)).rejects.toBeInstanceOf(HaltError);
      expect(context.haltRejection).toBeInstanceOf(HaltError);
      // Continue rejections should still be preserved
      expect(context.continueRejections).toContain(continueError);
    });

    it("should preserve existing continue rejections when halt occurs", async () => {
      const existingError = new AdviceError("after", ["existing error"]);
      const targetError = new TargetError(new Error("target error"));

      const context = createMockChainContext({
        continueRejections: [existingError],
      });
      const chain = () => context;

      const handleTask = handleRejection(chain);

      await expect(handleTask(targetError)).rejects.toBeInstanceOf(HaltError);

      // Existing continue rejections should be preserved
      expect(context.continueRejections).toContain(existingError);
      expect(context.haltRejection).toBeInstanceOf(HaltError);
    });

    it("should work with checkRejection after handling", async () => {
      const context = createMockChainContext();
      const chain = () => context;

      // First handle an error to set haltRejection
      const handleTask = handleRejection(chain);
      await expect(handleTask(new Error("test"))).rejects.toBeInstanceOf(
        HaltError,
      );

      // Now checkRejection should throw the haltRejection
      const checkTask = checkRejection(chain);
      await expect(checkTask()).rejects.toBe(context.haltRejection);
    });
  });
});
