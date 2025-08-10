import {
  createCommonTarget,
  createFailingTestTarget,
  createLoggingContext,
  createLoggingTestAspect,
  StandardTestContext,
} from "@/__tests__/test-utils";
import {
  AsyncContext,
  createAspect,
  createProcess,
  runProcess,
  TARGET_FALLBACK,
} from "@/index";

describe("Integration – Promise-AOP", () => {
  describe("happy path", () => {
    it("executes full chain and preserves result", async () => {
      const calls: string[] = [];
      const LoggingAspect = createLoggingTestAspect<number>();

      const process = createProcess<number, StandardTestContext>({
        aspects: [LoggingAspect],
      });

      const context = createLoggingContext(calls);
      const target = createCommonTarget<number>(42);

      const result = await runProcess({ process, context, target });

      expect(result).toBe(42);
      expect(calls).toEqual([
        "before",
        "around:before",
        "around:after",
        "afterReturning",
        "after",
      ]);
    });
  });

  describe("error handling", () => {
    it("runs afterThrowing, halts, and returns fallback via resolver", async () => {
      const calls: string[] = [];
      const LoggingAspect = createLoggingTestAspect<number>();

      const resolveHaltRejection = jest.fn().mockResolvedValue(TARGET_FALLBACK);
      const resolveContinuousRejection = jest.fn();

      const process = createProcess<number, StandardTestContext>({
        aspects: [LoggingAspect],
        processOptions: {
          resolveHaltRejection,
          resolveContinuousRejection,
        },
      });

      const context = createLoggingContext(calls);
      const target = createFailingTestTarget<number>("target failed");

      const result = await runProcess({ process, context, target });

      expect(result).toBe(TARGET_FALLBACK);
      expect(resolveHaltRejection).toHaveBeenCalledTimes(1);
      // afterThrowing should log and after should always run
      expect(calls.some((c) => c.startsWith("afterThrowing:"))).toBe(true);
      expect(calls[calls.length - 1]).toBe("after");
    });
  });

  describe("dependency ordering & section locking", () => {
    it("honors dependsOn ordering between before advices", async () => {
      const calls: string[] = [];

      const A = createAspect<number, StandardTestContext>((createAdvice) => ({
        name: "A",
        before: createAdvice({
          use: ["log"],
          advice: async ({ log }) => log.info("A.before"),
        }),
      }));

      const B = createAspect<number, StandardTestContext>((createAdvice) => ({
        name: "B",
        before: createAdvice({
          use: ["log"],
          dependsOn: ["A"],
          advice: async ({ log }) => log.info("B.before"),
        }),
      }));

      const process = createProcess<number, StandardTestContext>({
        aspects: [A, B],
      });

      const context = createLoggingContext(calls);
      const target = createCommonTarget<number>(1);

      const result = await runProcess({ process, context, target });

      expect(result).toBe(1);
      const aIndex = calls.indexOf("A.before");
      const bIndex = calls.indexOf("B.before");
      expect(aIndex).toBeGreaterThanOrEqual(0);
      expect(bIndex).toBeGreaterThan(aIndex);
    });

    it("detects section conflict for same-level parallel before advices", async () => {
      const A = createAspect<number, StandardTestContext>((createAdvice) => ({
        name: "A",
        before: createAdvice({
          use: ["log"],
          advice: async () => {},
        }),
      }));

      const B = createAspect<number, StandardTestContext>((createAdvice) => ({
        name: "B",
        before: createAdvice({
          use: ["log"],
          advice: async () => {},
        }),
      }));

      const process = createProcess<number, StandardTestContext>({
        aspects: [A, B],
        // default before.execution is parallel → conflict should be detected
      });

      const context = () =>
        ({
          log: { info: jest.fn(), error: jest.fn() },
        }) as StandardTestContext;
      const target = createCommonTarget<number>(0);

      await expect(runProcess({ process, context, target })).rejects.toThrow(
        /Section conflict:/,
      );
    });
  });

  describe("AsyncContext integration", () => {
    it("accepts AsyncContext instance for context propagation", async () => {
      const calls: string[] = [];
      const LoggingAspect = createLoggingTestAspect<number>();

      const process = createProcess<number, StandardTestContext>({
        aspects: [LoggingAspect],
      });

      const ac = AsyncContext.create<StandardTestContext>(() => ({
        log: { info: (msg: string) => calls.push(msg), error: jest.fn() },
      }));

      const target = createCommonTarget<number>(7);
      const result = await runProcess({ process, context: ac, target });

      expect(result).toBe(7);
      expect(calls).toEqual([
        "before",
        "around:before",
        "around:after",
        "afterReturning",
        "after",
      ]);
    });
  });
});
