import type { StandardTestContext } from "@/__tests__/test-utils";
import { createAspect } from "@/createAspect";
import { organizeAdvice } from "@/lib/features/organizing/organizeAdvice";
import {
  type __Props,
  organizeAspect,
} from "@/lib/features/organizing/organizeAspect";
import { processBatchAdvice } from "@/lib/features/processing/processBatchAdvice";
import { Advice } from "@/lib/models/advice";
import type { Aspect } from "@/lib/models/aspect";
import {
  defaultBuildOptions,
  normalizeBuildOptions,
  type RequiredBuildOptions,
} from "@/lib/models/buildOptions";

// Mock dependencies
jest.mock("@/lib/features/organizing/organizeAdvice");
jest.mock("@/lib/features/processing/processBatchAdvice");

const mockOrganizeAdvice = organizeAdvice as jest.MockedFunction<
  typeof organizeAdvice
>;
const mockProcessBatchAdvice = processBatchAdvice as jest.MockedFunction<
  typeof processBatchAdvice
>;

type TestContext = StandardTestContext & {
  readonly db: { query: () => Promise<void> };
  readonly auth: { check: () => Promise<boolean> };
  readonly logger: { info: (msg: string) => void };
};

type TestResult = { id: string };

function createTestProps(
  aspects: readonly Aspect<TestResult, TestContext>[],
  buildOptions: RequiredBuildOptions = defaultBuildOptions(),
): __Props<TestResult, TestContext> {
  return { aspects, buildOptions };
}

describe("organizeAspect", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock behavior - return empty execution for all advice types
    mockOrganizeAdvice.mockResolvedValue([]);
    mockProcessBatchAdvice.mockResolvedValue(undefined);
  });

  describe("aspect collection", () => {
    it("should handle empty aspects array", async () => {
      const props = createTestProps([]);
      const organization = await organizeAspect(props);

      // Should have all advice functions
      expect(typeof organization.before).toBe("function");
      expect(typeof organization.around).toBe("function");
      expect(typeof organization.after).toBe("function");
      expect(typeof organization.afterReturning).toBe("function");
      expect(typeof organization.afterThrowing).toBe("function");

      // All advice types should be called with empty groups
      expect(mockOrganizeAdvice).toHaveBeenCalledTimes(5);

      for (const adviceType of Advice) {
        expect(mockOrganizeAdvice).toHaveBeenCalledWith({
          options: defaultBuildOptions().advice[adviceType],
          adviceGroup: [],
        });
      }
    });

    it("should collect advice by type from multiple aspects", async () => {
      const aspectA = createAspect<TestResult, TestContext>((createAdvice) => ({
        name: "A",
        before: createAdvice({
          use: ["logger"],
          advice: async ({ logger }) => {
            logger.info("A before");
          },
        }),
        around: createAdvice({
          use: ["db"],
          advice: async ({ db }, wrap) => {
            wrap((target) => async () => {
              await db.query();
              return target();
            });
          },
        }),
      }));

      const aspectB = createAspect<TestResult, TestContext>((createAdvice) => ({
        name: "B",
        before: createAdvice({
          use: ["auth"],
          advice: async ({ auth }) => {
            await auth.check();
          },
        }),
        after: createAdvice({
          use: ["logger"],
          advice: async ({ logger }) => {
            logger.info("B after");
          },
        }),
      }));

      const props = createTestProps([aspectA, aspectB]);
      await organizeAspect(props);

      // Verify before advice collection
      expect(mockOrganizeAdvice).toHaveBeenCalledWith({
        options: defaultBuildOptions().advice.before,
        adviceGroup: [
          ["A", aspectA.before!],
          ["B", aspectB.before!],
        ],
      });

      // Verify around advice collection
      expect(mockOrganizeAdvice).toHaveBeenCalledWith({
        options: defaultBuildOptions().advice.around,
        adviceGroup: [["A", aspectA.around!]],
      });

      // Verify after advice collection
      expect(mockOrganizeAdvice).toHaveBeenCalledWith({
        options: defaultBuildOptions().advice.after,
        adviceGroup: [["B", aspectB.after!]],
      });

      // Verify empty collections for unused advice types
      expect(mockOrganizeAdvice).toHaveBeenCalledWith({
        options: defaultBuildOptions().advice.afterReturning,
        adviceGroup: [],
      });

      expect(mockOrganizeAdvice).toHaveBeenCalledWith({
        options: defaultBuildOptions().advice.afterThrowing,
        adviceGroup: [],
      });
    });
  });

  describe("advice function execution", () => {
    it("should delegate to processBatchAdvice with correct parameters", async () => {
      const aspectA = createAspect<TestResult, TestContext>((createAdvice) => ({
        name: "A",
        before: createAdvice({
          use: ["logger"],
          advice: async ({ logger }) => {
            logger.info("test");
          },
        }),
      }));

      // Mock execution result
      const mockExecution = [[aspectA.before!]];
      // @ts-expect-error - simplified mock for testing
      mockOrganizeAdvice.mockResolvedValue(mockExecution);

      const props = createTestProps([aspectA]);
      const organization = await organizeAspect(props);

      // Test context and arguments
      const testContext = {
        log: { info: jest.fn() },
        db: { query: async () => {} },
        auth: { check: async () => true },
        logger: { info: jest.fn() },
      };

      // Execute before advice
      await organization.before(testContext);

      expect(mockProcessBatchAdvice).toHaveBeenCalledWith({
        options: defaultBuildOptions().advice.before,
        execution: mockExecution,
        adviceType: "before",
        context: testContext,
        args: [],
      });
    });

    it("should pass arguments correctly for around advice", async () => {
      const aspectA = createAspect<TestResult, TestContext>((createAdvice) => ({
        name: "A",
        around: createAdvice({
          use: ["db"],
          advice: async (_, wrap) => {
            wrap((target) => target);
          },
        }),
      }));

      const mockExecution = [[aspectA.around!]];
      // @ts-expect-error - simplified mock for testing
      mockOrganizeAdvice.mockResolvedValue(mockExecution);

      const props = createTestProps([aspectA]);
      const organization = await organizeAspect(props);

      const testContext = {
        log: { info: jest.fn() },
        db: { query: async () => {} },
        auth: { check: async () => true },
        logger: { info: jest.fn() },
      };

      const mockWrap = jest.fn();
      await organization.around(testContext, mockWrap);

      expect(mockProcessBatchAdvice).toHaveBeenCalledWith({
        options: defaultBuildOptions().advice.around,
        execution: mockExecution,
        adviceType: "around",
        context: testContext,
        args: [mockWrap],
      });
    });

    it("should pass error argument for afterThrowing advice", async () => {
      const aspectA = createAspect<TestResult, TestContext>((createAdvice) => ({
        name: "A",
        afterThrowing: createAdvice({
          use: ["logger"],
          advice: async ({ logger }, error) => {
            logger.info(`Error: ${String(error)}`);
          },
        }),
      }));

      const mockExecution = [[aspectA.afterThrowing!]];
      // @ts-expect-error - simplified mock for testing
      mockOrganizeAdvice.mockResolvedValue(mockExecution);

      const props = createTestProps([aspectA]);
      const organization = await organizeAspect(props);

      const testContext = {
        log: { info: jest.fn() },
        db: { query: async () => {} },
        auth: { check: async () => true },
        logger: { info: jest.fn() },
      };

      const testError = new Error("test error");
      await organization.afterThrowing(testContext, testError);

      expect(mockProcessBatchAdvice).toHaveBeenCalledWith({
        options: defaultBuildOptions().advice.afterThrowing,
        execution: mockExecution,
        adviceType: "afterThrowing",
        context: testContext,
        args: [testError],
      });
    });
  });

  describe("build options propagation", () => {
    it("should use type-specific options for each advice type", async () => {
      const customBuildOptions = normalizeBuildOptions({
        advice: {
          before: {
            execution: "sequential",
            error: {
              aggregation: "all",
              runtime: { afterThrow: "continue" },
            },
          },
        },
      });

      const aspectA = createAspect<TestResult, TestContext>((createAdvice) => ({
        name: "A",
        before: createAdvice({
          advice: async () => {},
        }),
      }));

      const props = createTestProps([aspectA], customBuildOptions);
      await organizeAspect(props);

      // Verify custom options are passed to organizeAdvice
      expect(mockOrganizeAdvice).toHaveBeenCalledWith({
        options: customBuildOptions.advice.before,
        adviceGroup: [["A", aspectA.before!]],
      });
    });
  });
});
