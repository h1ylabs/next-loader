/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  type __Props,
  processBatchAdvice,
} from "@/lib/features/processing/processBatchAdvice";
import type {
  Advice,
  AdviceExecution,
  AdviceFunction,
  AdviceFunctionWithContext,
} from "@/lib/models/advice";
import type {
  AggregationUnit,
  RequiredBuildOptions,
} from "@/lib/models/buildOptions";
import { Rejection } from "@/lib/models/rejection";
import { Restricted, type SectionsUsed } from "@/lib/utils/RestrictedContext";

describe("processBatchAdvice", () => {
  type TestSharedContext = {
    readonly database: string;
    readonly cache: string;
    readonly logger: string;
  };

  type TestResult = number;
  type TestAdviceType = Extract<Advice, "before" | "after">;

  const createTestContext = (): TestSharedContext => ({
    database: "test-db",
    cache: "test-cache",
    logger: "test-logger",
  });

  const createTestOptions = (
    aggregation: AggregationUnit = "unit",
  ): RequiredBuildOptions["advice"][TestAdviceType] => ({
    execution: "parallel",
    error: {
      aggregation,
      runtime: {
        afterThrow: "halt",
      },
    },
  });

  const createSuccessfulAdvice =
    (
      delay: number = 0,
    ): AdviceFunctionWithContext<
      TestResult,
      TestSharedContext,
      TestAdviceType
    > =>
    async () => {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    };

  const createFailingAdvice =
    (
      errorMessage: string,
      delay: number = 0,
    ): AdviceFunctionWithContext<
      TestResult,
      TestSharedContext,
      TestAdviceType
    > =>
    async () => {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      throw new Error(errorMessage);
    };

  const createTestProps = <AdviceType extends TestAdviceType>({
    execution,
    options,
    adviceType,
    context = createTestContext(),
    args = [] as Parameters<AdviceFunction<TestResult, AdviceType>>,
  }: {
    execution: AdviceExecution<TestResult, TestSharedContext, AdviceType>;
    options: RequiredBuildOptions["advice"][AdviceType];
    adviceType: AdviceType;
    context?: TestSharedContext;
    args?: Parameters<AdviceFunction<TestResult, AdviceType>>;
  }): __Props<TestResult, TestSharedContext, AdviceType> => ({
    execution,
    options,
    adviceType,
    context,
    args,
  });

  describe("all advice succeed", () => {
    it("should complete successfully when all advice resolve", async () => {
      const execution: AdviceExecution<
        TestResult,
        TestSharedContext,
        "before"
      > = [
        [
          { advice: createSuccessfulAdvice(10) },
          { advice: createSuccessfulAdvice(5) },
        ],
        [{ advice: createSuccessfulAdvice(15) }],
      ];

      const props = createTestProps({
        execution,
        options: createTestOptions("unit"),
        adviceType: "before",
      });

      await expect(processBatchAdvice(props)).resolves.toBeUndefined();
    });

    it("should complete successfully with empty execution", async () => {
      const execution: AdviceExecution<TestResult, TestSharedContext, "after"> =
        [];

      const props = createTestProps({
        execution,
        options: createTestOptions("all"),
        adviceType: "after",
      });

      await expect(processBatchAdvice(props)).resolves.toBeUndefined();
    });
  });

  describe("unit aggregation", () => {
    it("should throw immediately when first group has error", async () => {
      const execution: AdviceExecution<
        TestResult,
        TestSharedContext,
        "before"
      > = [
        [
          { advice: createSuccessfulAdvice() },
          { advice: createFailingAdvice("First group error") },
        ],
        [
          { advice: createSuccessfulAdvice() }, // This should not be executed
        ],
      ];

      const props = createTestProps({
        execution,
        options: createTestOptions("unit"),
        adviceType: "before",
      });

      await expect(processBatchAdvice(props)).rejects.toThrow(Rejection);

      try {
        await processBatchAdvice(props);
      } catch (error) {
        expect(error).toBeInstanceOf(Rejection);
        if (error instanceof Rejection) {
          expect(error.info.occurredFrom).toBe("advice");
          if (error.info.occurredFrom === "advice") {
            expect(error.info.advice).toBe("before");
          }
          expect(Array.isArray(error.errors)).toBe(true);
          const errors = error.errors as unknown[];
          expect(errors).toHaveLength(1);
          expect(errors[0]).toBeInstanceOf(Error);
          expect((errors[0] as Error).message).toBe("First group error");
        }
      }
    });

    it("should throw immediately when second group has error", async () => {
      const execution: AdviceExecution<
        TestResult,
        TestSharedContext,
        "before"
      > = [
        [
          { advice: createSuccessfulAdvice() },
          { advice: createSuccessfulAdvice() },
        ],
        [{ advice: createFailingAdvice("Second group error") }],
      ];

      const props = createTestProps({
        execution,
        options: createTestOptions("unit"),
        adviceType: "before",
      });

      await expect(processBatchAdvice(props)).rejects.toThrow(Rejection);
    });

    it("should collect all errors from single group with multiple failures", async () => {
      const execution: AdviceExecution<
        TestResult,
        TestSharedContext,
        "before"
      > = [
        [
          { advice: createFailingAdvice("Error 1") },
          { advice: createSuccessfulAdvice() },
          { advice: createFailingAdvice("Error 2") },
        ],
      ];

      const props = createTestProps({
        execution,
        options: createTestOptions("unit"),
        adviceType: "before",
      });

      try {
        await processBatchAdvice(props);
        fail("Expected Rejection to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Rejection);
        if (error instanceof Rejection) {
          const errors = error.errors as unknown[];
          expect(errors).toHaveLength(2);
          const errorMessages = errors.map((e) => (e as Error).message);
          expect(errorMessages).toContain("Error 1");
          expect(errorMessages).toContain("Error 2");
        }
      }
    });
  });

  describe("all aggregation", () => {
    it("should collect errors from all groups and throw at the end", async () => {
      const execution: AdviceExecution<TestResult, TestSharedContext, "after"> =
        [
          [
            { advice: createFailingAdvice("Group 1 Error 1") },
            { advice: createSuccessfulAdvice() },
            { advice: createFailingAdvice("Group 1 Error 2") },
          ],
          [{ advice: createSuccessfulAdvice() }],
          [{ advice: createFailingAdvice("Group 3 Error") }],
        ];

      const props = createTestProps({
        execution,
        options: createTestOptions("all"),
        adviceType: "after",
      });

      try {
        await processBatchAdvice(props);
        fail("Expected Rejection to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Rejection);
        if (error instanceof Rejection) {
          expect(error.info.occurredFrom).toBe("advice");
          if (error.info.occurredFrom === "advice") {
            expect(error.info.advice).toBe("after");
          }
          const errors = error.errors as unknown[];
          expect(errors).toHaveLength(3);
          const errorMessages = errors.map((e) => (e as Error).message);
          expect(errorMessages).toContain("Group 1 Error 1");
          expect(errorMessages).toContain("Group 1 Error 2");
          expect(errorMessages).toContain("Group 3 Error");
        }
      }
    });

    it("should complete successfully when no errors occur", async () => {
      const execution: AdviceExecution<TestResult, TestSharedContext, "after"> =
        [
          [
            { advice: createSuccessfulAdvice() },
            { advice: createSuccessfulAdvice() },
          ],
          [{ advice: createSuccessfulAdvice() }],
        ];

      const props = createTestProps({
        execution,
        options: createTestOptions("all"),
        adviceType: "after",
      });

      await expect(processBatchAdvice(props)).resolves.toBeUndefined();
    });
  });

  describe("RestrictedContext usage", () => {
    it("should pass correct restricted context to advice based on use sections", async () => {
      let capturedContext:
        | Restricted<TestSharedContext, ["database", "logger"]>
        | undefined;

      const contextCapturingAdvice = async (
        context: Restricted<TestSharedContext, ["database", "logger"]>,
      ) => {
        capturedContext = context;
        // Access allowed sections
        expect(context.database).toBe("test-db");
        expect(context.logger).toBe("test-logger");
      };

      const execution: AdviceExecution<
        TestResult,
        TestSharedContext,
        "before"
      > = [
        [
          {
            advice: contextCapturingAdvice,
            use: ["database", "logger"] as const,
          },
        ],
      ];

      const props = createTestProps({
        execution,
        options: createTestOptions("unit"),
        adviceType: "before",
      });

      await processBatchAdvice(props);

      expect(capturedContext).toBeDefined();
      if (capturedContext) {
        expect(capturedContext.database).toBe("test-db");
        expect(capturedContext.logger).toBe("test-logger");
      }
    });

    it("should handle advice with no use sections (empty array)", async () => {
      const minimalAdvice = async (
        _context: Restricted<TestSharedContext, []>,
      ) => {
        // Should have no access to any context properties
      };

      const execution: AdviceExecution<
        TestResult,
        TestSharedContext,
        "before"
      > = [
        [
          {
            advice: minimalAdvice,
            use: [] as const,
          },
        ],
      ];

      const props = createTestProps({
        execution,
        options: createTestOptions("unit"),
        adviceType: "before",
      });

      await expect(processBatchAdvice(props)).resolves.toBeUndefined();
    });

    it("should handle advice without explicit use property", async () => {
      const defaultAdvice = async (
        _context: Restricted<
          TestSharedContext,
          SectionsUsed<TestSharedContext>
        >,
      ) => {
        // Default behavior when use is not specified
      };

      const execution: AdviceExecution<
        TestResult,
        TestSharedContext,
        "before"
      > = [[{ advice: defaultAdvice }]];

      const props = createTestProps({
        execution,
        options: createTestOptions("unit"),
        adviceType: "before",
      });

      await expect(processBatchAdvice(props)).resolves.toBeUndefined();
    });
  });

  describe("args parameter passing", () => {
    it("should pass args correctly to advice functions", async () => {
      const mockArgs: Parameters<AdviceFunction<TestResult, "before">> = [];
      let receivedArgs:
        | Parameters<AdviceFunction<TestResult, "before">>
        | undefined;

      const argsCapturingAdvice = async (
        _context: TestSharedContext,
        ...args: Parameters<AdviceFunction<TestResult, "before">>
      ) => {
        receivedArgs = args;
      };

      const execution: AdviceExecution<
        TestResult,
        TestSharedContext,
        "before"
      > = [[{ advice: argsCapturingAdvice }]];

      const props = createTestProps({
        execution,
        options: createTestOptions("unit"),
        adviceType: "before",
        args: mockArgs,
      });

      await processBatchAdvice(props);

      expect(receivedArgs).toEqual(mockArgs);
    });
  });

  describe("validateType integration", () => {
    it("should validate aggregation type correctly", async () => {
      const execution: AdviceExecution<
        TestResult,
        TestSharedContext,
        "before"
      > = [[{ advice: createSuccessfulAdvice() }]];

      const invalidOptions = {
        execution: "parallel" as const,
        error: {
          aggregation: "invalid" as AggregationUnit, // Invalid aggregation type
          runtime: { afterThrow: "halt" as const },
        },
      };

      const props = createTestProps({
        execution,
        options: invalidOptions,
        adviceType: "before",
      });

      // Should throw validation error before processing advice
      await expect(processBatchAdvice(props)).rejects.toThrow();
    });
  });

  describe("Promise.allSettled behavior", () => {
    it("should handle mixed success and failure in same group correctly", async () => {
      const results: string[] = [];

      const slowSuccessAdvice = async (_context: TestSharedContext) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        results.push("slow-success");
      };

      const fastFailAdvice = async (_context: TestSharedContext) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        results.push("fast-fail");
        throw new Error("Fast failure");
      };

      const execution: AdviceExecution<
        TestResult,
        TestSharedContext,
        "before"
      > = [[{ advice: slowSuccessAdvice }, { advice: fastFailAdvice }]];

      const props = createTestProps({
        execution,
        options: createTestOptions("unit"),
        adviceType: "before",
      });

      try {
        await processBatchAdvice(props);
        fail("Expected Rejection to be thrown");
      } catch (error) {
        // Both advice should have been executed despite one failing
        expect(results).toContain("slow-success");
        expect(results).toContain("fast-fail");
        expect(error).toBeInstanceOf(Rejection);
      }
    });
  });
});
