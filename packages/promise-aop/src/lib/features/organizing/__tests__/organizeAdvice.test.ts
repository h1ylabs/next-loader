import {
  type __Props,
  MSG_ERR_RESOLVE_DEPS_DUPLICATE_ASPECT_ADVICE_WITH_CONTEXT,
  MSG_ERR_RESOLVE_DEPS_MISSING_DEPENDENCY_WITH_CONTEXT,
  MSG_ERR_RESOLVE_DEPS_SECTION_CONFLICT_WITH_CONTEXT,
  organizeAdvice,
} from "@/lib/features/organizing/organizeAdvice";
import type {
  Advice,
  AdviceFunctionWithContext,
  AdviceMetadata,
} from "@/lib/models/advice";
import { type ExecutionStrategy } from "@/lib/models/buildOptions";

// test constants
const SECTIONS = {
  DB: "db" as const,
  CACHE: "cache" as const,
  LOGGER: "logger" as const,
} as const;

const EXECUTION_STRATEGIES = {
  PARALLEL: "parallel" as const,
  SEQUENTIAL: "sequential" as const,
} as const;

type TestContext = {
  readonly db: { query: () => Promise<void> };
  readonly cache: { get: () => Promise<unknown> };
  readonly logger: { info: (msg: string) => void };
};

type TestResult = { id: string };

// helper to create advice metadata with test stub
function createAdviceMetadata<T extends Advice>(
  name: string,
  options?: {
    readonly use?: readonly (keyof TestContext)[];
    readonly dependsOn?: readonly string[];
  },
): readonly [string, AdviceMetadata<TestResult, TestContext, T>] {
  return [
    name,
    {
      use: options?.use,
      dependsOn: options?.dependsOn,
      // test stub: simplified mock for testing
      advice: jest
        .fn()
        .mockResolvedValue(undefined) as AdviceFunctionWithContext<
        TestResult,
        TestContext,
        T
      >,
    },
  ] as const;
}

// helper to create test props
function createProps<T extends Advice>(
  execution: ExecutionStrategy,
  adviceGroup: readonly (readonly [
    string,
    AdviceMetadata<TestResult, TestContext, T>,
  ])[],
): __Props<TestResult, TestContext, T> {
  return {
    options: {
      execution,
      error: {
        aggregation: "unit" as const,
        runtime: { afterThrow: "halt" as const },
      },
    },
    adviceGroup,
  };
}

describe("organizeAdvice", () => {
  describe("basic functionality", () => {
    it("should return empty array for empty input", async () => {
      const props = createProps("parallel", []);
      const result = await organizeAdvice(props);
      expect(result).toEqual([]);
    });

    it("should handle single advice without dependencies", async () => {
      const advice = createAdviceMetadata("A");
      const props = createProps("parallel", [advice]);

      const result = await organizeAdvice(props);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0]![0]).toBe(advice[1]);
    });
  });

  describe("execution strategy behavior", () => {
    it("should organize dependency graph levels in parallel mode", async () => {
      const adviceD = createAdviceMetadata("D");
      const adviceC = createAdviceMetadata("C");
      const adviceB = createAdviceMetadata("B", { dependsOn: ["D"] });
      const adviceA = createAdviceMetadata("A", {
        dependsOn: ["B", "C"],
      });

      const props = createProps(EXECUTION_STRATEGIES.PARALLEL, [
        adviceD,
        adviceC,
        adviceB,
        adviceA,
      ]);
      const result = await organizeAdvice(props);

      expect(result).toHaveLength(3);
      // level 0: D, C (order within level is not guaranteed)
      expect(result[0]).toHaveLength(2);
      expect(
        result[0]!.map(
          (advice) => advice === adviceD[1] || advice === adviceC[1],
        ),
      ).toEqual([true, true]);
      // level 1: B
      expect(result[1]).toHaveLength(1);
      expect(result[1]![0]).toBe(adviceB[1]);
      // level 2: A
      expect(result[2]).toHaveLength(1);
      expect(result[2]![0]).toBe(adviceA[1]);
    });

    it("should create singleton groups in sequential mode", async () => {
      const adviceB = createAdviceMetadata("B");
      const adviceA = createAdviceMetadata("A", { dependsOn: ["B"] });

      const props = createProps(EXECUTION_STRATEGIES.SEQUENTIAL, [
        adviceB,
        adviceA,
      ]);
      const result = await organizeAdvice(props);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual([adviceB[1]]);
      expect(result[1]).toEqual([adviceA[1]]);
    });
  });

  describe("section conflicts", () => {
    it("should allow same section usage across different dependency levels", async () => {
      const adviceB = createAdviceMetadata("B", { use: [SECTIONS.DB] });
      const adviceA = createAdviceMetadata("A", {
        dependsOn: ["B"],
        use: [SECTIONS.DB],
      });

      const props = createProps(EXECUTION_STRATEGIES.PARALLEL, [
        adviceB,
        adviceA,
      ]);

      await expect(organizeAdvice(props)).resolves.toHaveLength(2);
    });

    it("should detect section conflicts within same level in parallel mode", async () => {
      const adviceA = createAdviceMetadata("A", { use: [SECTIONS.DB] });
      const adviceB = createAdviceMetadata("B", { use: [SECTIONS.DB] });

      const props = createProps(EXECUTION_STRATEGIES.PARALLEL, [
        adviceA,
        adviceB,
      ]);

      await expect(organizeAdvice(props)).rejects.toThrow(
        new Error(
          MSG_ERR_RESOLVE_DEPS_SECTION_CONFLICT_WITH_CONTEXT(
            SECTIONS.DB,
            "B",
            "A",
          ),
        ),
      );
    });

    it("should detect section conflicts within same level in sequential mode", async () => {
      const adviceA = createAdviceMetadata("A", { use: [SECTIONS.DB] });
      const adviceB = createAdviceMetadata("B", { use: [SECTIONS.DB] });

      const props = createProps(EXECUTION_STRATEGIES.SEQUENTIAL, [
        adviceA,
        adviceB,
      ]);

      await expect(organizeAdvice(props)).rejects.toThrow(
        new Error(
          MSG_ERR_RESOLVE_DEPS_SECTION_CONFLICT_WITH_CONTEXT(
            SECTIONS.DB,
            "B",
            "A",
          ),
        ),
      );
    });

    it("should handle multiple sections per advice without conflicts", async () => {
      const adviceA = createAdviceMetadata("A", {
        use: [SECTIONS.DB, SECTIONS.CACHE],
      });
      const adviceB = createAdviceMetadata("B", { use: [SECTIONS.LOGGER] });

      const props = createProps(EXECUTION_STRATEGIES.PARALLEL, [
        adviceA,
        adviceB,
      ]);

      await expect(organizeAdvice(props)).resolves.toHaveLength(1);
    });

    it("should detect conflicts across multiple sections", async () => {
      const adviceA = createAdviceMetadata("A", {
        use: [SECTIONS.DB, SECTIONS.CACHE],
      });
      const adviceB = createAdviceMetadata("B", {
        use: [SECTIONS.CACHE, SECTIONS.LOGGER],
      });

      const props = createProps(EXECUTION_STRATEGIES.PARALLEL, [
        adviceA,
        adviceB,
      ]);

      await expect(organizeAdvice(props)).rejects.toThrow(
        new Error(
          MSG_ERR_RESOLVE_DEPS_SECTION_CONFLICT_WITH_CONTEXT(
            SECTIONS.CACHE,
            "B",
            "A",
          ),
        ),
      );
    });

    describe("section conflicts across other phases", () => {
      it("should detect conflict in after phase", async () => {
        const adviceA = createAdviceMetadata<"after">("A", {
          use: [SECTIONS.DB],
        });
        const adviceB = createAdviceMetadata<"after">("B", {
          use: [SECTIONS.DB],
        });

        const props = createProps<"after">(EXECUTION_STRATEGIES.PARALLEL, [
          adviceA,
          adviceB,
        ]);

        await expect(organizeAdvice(props)).rejects.toThrow(
          new Error(
            MSG_ERR_RESOLVE_DEPS_SECTION_CONFLICT_WITH_CONTEXT(
              SECTIONS.DB,
              "B",
              "A",
            ),
          ),
        );
      });

      it("should detect conflict in afterReturning phase", async () => {
        const adviceA = createAdviceMetadata<"afterReturning">("A", {
          use: [SECTIONS.DB],
        });
        const adviceB = createAdviceMetadata<"afterReturning">("B", {
          use: [SECTIONS.DB],
        });

        const props = createProps<"afterReturning">(
          EXECUTION_STRATEGIES.PARALLEL,
          [adviceA, adviceB],
        );

        await expect(organizeAdvice(props)).rejects.toThrow(
          new Error(
            MSG_ERR_RESOLVE_DEPS_SECTION_CONFLICT_WITH_CONTEXT(
              SECTIONS.DB,
              "B",
              "A",
            ),
          ),
        );
      });

      it("should detect conflict in afterThrowing phase", async () => {
        const adviceA = createAdviceMetadata<"afterThrowing">("A", {
          use: [SECTIONS.DB],
        });
        const adviceB = createAdviceMetadata<"afterThrowing">("B", {
          use: [SECTIONS.DB],
        });

        const props = createProps<"afterThrowing">(
          EXECUTION_STRATEGIES.PARALLEL,
          [adviceA, adviceB],
        );

        await expect(organizeAdvice(props)).rejects.toThrow(
          new Error(
            MSG_ERR_RESOLVE_DEPS_SECTION_CONFLICT_WITH_CONTEXT(
              SECTIONS.DB,
              "B",
              "A",
            ),
          ),
        );
      });

      it("should detect conflict in around phase", async () => {
        const adviceA = createAdviceMetadata<"around">("A", {
          use: [SECTIONS.DB],
        });
        const adviceB = createAdviceMetadata<"around">("B", {
          use: [SECTIONS.DB],
        });

        const props = createProps<"around">(EXECUTION_STRATEGIES.PARALLEL, [
          adviceA,
          adviceB,
        ]);

        await expect(organizeAdvice(props)).rejects.toThrow(
          new Error(
            MSG_ERR_RESOLVE_DEPS_SECTION_CONFLICT_WITH_CONTEXT(
              SECTIONS.DB,
              "B",
              "A",
            ),
          ),
        );
      });
    });
  });

  describe("error cases", () => {
    it("should throw detailed error on duplicate aspect names", async () => {
      const advice1 = createAdviceMetadata("A");
      const advice2 = createAdviceMetadata("A");

      const props = createProps(EXECUTION_STRATEGIES.PARALLEL, [
        advice1,
        advice2,
      ]);

      await expect(organizeAdvice(props)).rejects.toThrow(
        new Error(
          MSG_ERR_RESOLVE_DEPS_DUPLICATE_ASPECT_ADVICE_WITH_CONTEXT(
            "A",
            advice1[1],
            advice2[1],
          ),
        ),
      );
    });

    it("should throw detailed error on missing dependencies with available aspects", async () => {
      const adviceA = createAdviceMetadata("A", {
        dependsOn: ["NonExistent"],
      });
      const adviceB = createAdviceMetadata("B");

      const props = createProps(EXECUTION_STRATEGIES.PARALLEL, [
        adviceA,
        adviceB,
      ]);

      await expect(organizeAdvice(props)).rejects.toThrow(
        new Error(
          MSG_ERR_RESOLVE_DEPS_MISSING_DEPENDENCY_WITH_CONTEXT(
            "A",
            "NonExistent",
            ["A", "B"],
          ),
        ),
      );
    });

    it("should detect simple circular dependencies", async () => {
      const adviceA = createAdviceMetadata("A", { dependsOn: ["B"] });
      const adviceB = createAdviceMetadata("B", { dependsOn: ["C"] });
      const adviceC = createAdviceMetadata("C", { dependsOn: ["A"] });

      const props = createProps(EXECUTION_STRATEGIES.PARALLEL, [
        adviceA,
        adviceB,
        adviceC,
      ]);

      await expect(organizeAdvice(props)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining("Cycle:"),
        }),
      );
    });

    it("should detect multiple separate circular dependencies", async () => {
      // First cycle: A → B → A
      const adviceA = createAdviceMetadata("A", { dependsOn: ["B"] });
      const adviceB = createAdviceMetadata("B", { dependsOn: ["A"] });
      // Second cycle: C → D → C
      const adviceC = createAdviceMetadata("C", { dependsOn: ["D"] });
      const adviceD = createAdviceMetadata("D", { dependsOn: ["C"] });

      const props = createProps(EXECUTION_STRATEGIES.PARALLEL, [
        adviceA,
        adviceB,
        adviceC,
        adviceD,
      ]);

      await expect(organizeAdvice(props)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining("Cycle:"),
        }),
      );
    });

    it("should detect mixed circular and non-circular dependencies", async () => {
      // circular: A → B → A
      const adviceA = createAdviceMetadata("A", { dependsOn: ["B"] });
      const adviceB = createAdviceMetadata("B", { dependsOn: ["A"] });
      // non-circular: E → F (no cycle)
      const adviceE = createAdviceMetadata("E", { dependsOn: ["F"] });
      const adviceF = createAdviceMetadata("F");

      const props = createProps(EXECUTION_STRATEGIES.PARALLEL, [
        adviceA,
        adviceB,
        adviceE,
        adviceF,
      ]);

      await expect(organizeAdvice(props)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining("Cycle:"),
        }),
      );
    });

    it("should throw on invalid execution strategy with type validation", async () => {
      const advice = createAdviceMetadata("A");
      const props = createProps(EXECUTION_STRATEGIES.PARALLEL, [advice]);

      // @ts-expect-error - intentionally testing invalid execution strategy
      props.options.execution = "invalid" as ExecutionStrategy;

      await expect(organizeAdvice(props)).rejects.toThrow("invalid type:");
    });
  });
});
