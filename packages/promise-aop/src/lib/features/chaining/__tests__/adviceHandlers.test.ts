import {
  createCommonAdvices,
  createCommonTarget,
  createIdDataContext,
  createProcessOptionsMock,
} from "@/__tests__/test-utils";
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
import {
  ContinuousRejection,
  HaltRejection,
  Rejection,
} from "@/lib/models/rejection";
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

  const createMockProcessOptions = (): RequiredProcessOptions<
    TestResult,
    TestSharedContext
  > => createProcessOptionsMock<TestResult, TestSharedContext>();

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

  describe("checkRejection", () => {
    it("should do nothing when haltRejection is undefined", async () => {
      const context = createMockChainContext();
      const chain = () => context;

      const checkTask = checkRejection(chain);

      await expect(checkTask()).resolves.toBeUndefined();
    });

    it("should throw haltRejection when it exists", async () => {
      const haltRejection = new HaltRejection([new Error("halted")], {
        occurredFrom: "unknown",
      });
      const context = createMockChainContext({
        haltRejection,
      });
      const chain = () => context;

      const checkTask = checkRejection(chain);

      await expect(checkTask()).rejects.toBe(haltRejection);
    });
  });

  describe("handleRejection", () => {
    it("should propagate HaltRejection without modification", async () => {
      const haltRejection = new HaltRejection([new Error("already halted")], {
        occurredFrom: "unknown",
      });
      const context = createMockChainContext();
      const chain = () => context;

      const handleTask = handleRejection(chain);

      await expect(handleTask(haltRejection)).rejects.toBe(haltRejection);
      expect(context.haltRejection).toBeUndefined();
      expect(context.continueRejections).toHaveLength(0);
    });

    describe("Rejection handling", () => {
      it("should handle Rejection with halt strategy", async () => {
        const rejection = new Rejection(["test error"], {
          occurredFrom: "advice",
          advice: "before",
        });

        const buildOptions = createMockBuildOptions();

        const context = createMockChainContext({ buildOptions });
        const chain = () => context;

        const handleTask = handleRejection(chain);

        // This should set haltRejection and then throw it
        await expect(handleTask(rejection)).rejects.toBeInstanceOf(
          HaltRejection,
        );
        expect(context.haltRejection).toBeInstanceOf(HaltRejection);
        expect(context.haltRejection?.errors).toEqual(rejection.errors);
        expect(context.continueRejections).toHaveLength(0);
      });

      it("should handle Rejection with continue strategy", async () => {
        const rejection = new Rejection(["test error"], {
          occurredFrom: "advice",
          advice: "after",
        });

        const buildOptions = createMockBuildOptions();

        const context = createMockChainContext({ buildOptions });
        const chain = () => context;

        const handleTask = handleRejection(chain);
        await handleTask(rejection);

        expect(context.haltRejection).toBeUndefined();
        expect(context.continueRejections).toHaveLength(1);
        expect(context.continueRejections[0]).toBeInstanceOf(
          ContinuousRejection,
        );
        expect((context.continueRejections[0] as Rejection).errors).toEqual(
          rejection.errors,
        );
      });
    });

    it("should convert unknown error to HaltRejection immediately", async () => {
      const unknownError = new Error("target failed");
      const context = createMockChainContext();
      const chain = () => context;

      const handleTask = handleRejection(chain);
      await expect(handleTask(unknownError)).rejects.toBeInstanceOf(
        HaltRejection,
      );

      expect(context.haltRejection).toBeInstanceOf(HaltRejection);
      expect(context.haltRejection?.errors).toEqual([unknownError]);
      expect(context.haltRejection?.info.occurredFrom).toBe("unknown");
      expect(context.continueRejections).toHaveLength(0);
    });

    it("should wrap unknown error in HaltRejection", async () => {
      const unknownError = new Error("unknown error");
      const context = createMockChainContext();
      const chain = () => context;

      const handleTask = handleRejection(chain);
      await expect(handleTask(unknownError)).rejects.toBeInstanceOf(
        HaltRejection,
      );

      expect(context.haltRejection).toBeInstanceOf(HaltRejection);
      expect(context.haltRejection?.errors).toEqual([unknownError]);
      expect(context.haltRejection?.info.occurredFrom).toBe("unknown");
      expect(context.continueRejections).toHaveLength(0);
    });

    it("should handle string errors by wrapping in HaltRejection", async () => {
      const stringError = "string error";
      const context = createMockChainContext();
      const chain = () => context;

      const handleTask = handleRejection(chain);
      await expect(handleTask(stringError)).rejects.toBeInstanceOf(
        HaltRejection,
      );

      expect(context.haltRejection).toBeInstanceOf(HaltRejection);
      expect(context.haltRejection?.errors).toEqual([stringError]);
      expect(context.haltRejection?.info.occurredFrom).toBe("unknown");
    });

    it("should handle null errors by wrapping in HaltRejection", async () => {
      const context = createMockChainContext();
      const chain = () => context;

      const handleTask = handleRejection(chain);
      await expect(handleTask(null)).rejects.toBeInstanceOf(HaltRejection);

      expect(context.haltRejection).toBeInstanceOf(HaltRejection);
      expect(context.haltRejection?.errors).toEqual([null]);
      expect(context.haltRejection?.info.occurredFrom).toBe("unknown");
    });
  });

  describe("integration scenarios", () => {
    it("should handle mixed error types in sequence", async () => {
      const continueRejection = new Rejection(["continue error"], {
        occurredFrom: "advice",
        advice: "after",
      });
      const haltRejection = new Rejection(["halt error"], {
        occurredFrom: "advice",
        advice: "before",
      });

      const buildOptions = createMockBuildOptions();

      const context = createMockChainContext({ buildOptions });
      const chain = () => context;
      const handleTask = handleRejection(chain);

      // First handle continue error
      await handleTask(continueRejection);
      expect(context.continueRejections).toHaveLength(1);
      expect(context.continueRejections[0]).toBeInstanceOf(ContinuousRejection);
      expect(context.haltRejection).toBeUndefined();

      // Then handle halt error - should set haltRejection and throw
      await expect(handleTask(haltRejection)).rejects.toBeInstanceOf(
        HaltRejection,
      );
      expect(context.haltRejection).toBeInstanceOf(HaltRejection);
      // Continue rejections should still be preserved
      expect(context.continueRejections).toHaveLength(1);
    });

    it("should preserve existing continue rejections when halt occurs", async () => {
      const existingRejection = new ContinuousRejection(["existing error"], {
        occurredFrom: "advice",
        advice: "after",
      });
      const targetError = new Error("target error");

      const context = createMockChainContext({
        continueRejections: [existingRejection],
      });
      const chain = () => context;

      const handleTask = handleRejection(chain);

      await expect(handleTask(targetError)).rejects.toBeInstanceOf(
        HaltRejection,
      );

      // Existing continue rejections should be preserved
      expect(context.continueRejections).toContain(existingRejection);
      expect(context.haltRejection).toBeInstanceOf(HaltRejection);
    });

    it("should work with checkRejection after handling", async () => {
      const context = createMockChainContext();
      const chain = () => context;

      // First handle an error to set haltRejection
      const handleTask = handleRejection(chain);
      await expect(handleTask(new Error("test"))).rejects.toBeInstanceOf(
        HaltRejection,
      );

      // Now checkRejection should throw the haltRejection
      const checkTask = checkRejection(chain);
      await expect(checkTask()).rejects.toBe(context.haltRejection);
    });
  });
});
