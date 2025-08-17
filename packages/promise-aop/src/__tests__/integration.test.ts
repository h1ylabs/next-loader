import {
  createCommonTarget,
  createFailingTestTarget,
  createFallbackProcessOptions,
  createLoggingContext,
  createLoggingTestAspect,
  pickOrder,
  runWith,
  StandardTestContext,
} from "@/__tests__/test-utils";
import { AsyncContext, createAspect, createProcess, runProcess } from "@/index";

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
    it("runs afterThrowing, halts, and returns fallback value via resolver", async () => {
      const calls: string[] = [];
      const LoggingAspect = createLoggingTestAspect<number>();
      const fallbackValue = -999;

      const resolveHaltRejection = jest.fn().mockResolvedValue(fallbackValue);
      const resolveContinuousRejection = jest.fn().mockResolvedValue(undefined);

      const process = createProcess<number, StandardTestContext>({
        aspects: [LoggingAspect],
        processOptions: {
          handleError: resolveHaltRejection,
          handleContinuedErrors: resolveContinuousRejection,
        },
      });

      const context = createLoggingContext(calls);
      const target = createFailingTestTarget<number>("target failed");

      const result = await runProcess({ process, context, target });

      expect(result).toBe(fallbackValue);
      expect(resolveHaltRejection).toHaveBeenCalledTimes(1);
      // afterThrowing should log and after should always run
      expect(calls.some((c) => c.startsWith("afterThrowing:"))).toBe(true);
      expect(calls[calls.length - 1]).toBe("after");
    });

    it("handles error recovery with proper fallback resolution", async () => {
      const calls: string[] = [];
      const fallbackValue = 42;

      const ErrorRecoveryAspect = createAspect<number, StandardTestContext>(
        (createAdvice) => ({
          name: "error-recovery",
          around: createAdvice({
            use: ["log"],
            advice: async ({ log }, { attachToTarget }) => {
              attachToTarget((target) => async () => {
                log.info("around:before-target");
                try {
                  const result = await target();
                  log.info("around:target-success");
                  return result;
                } catch (error) {
                  log.info("around:target-failed");
                  // continue strategy: let the error propagate to be handled by afterThrowing
                  throw error;
                }
              });
            },
          }),
          afterThrowing: createAdvice({
            use: ["log"],
            advice: async ({ log }) => {
              log.info(`afterThrowing:handled`);
            },
          }),
          afterReturning: createAdvice({
            use: ["log"],
            advice: async ({ log }) => {
              log.info("afterReturning:executed");
            },
          }),
        }),
      );

      const process = createProcess<number, StandardTestContext>({
        aspects: [ErrorRecoveryAspect],
        processOptions: {
          handleError: jest.fn().mockResolvedValue(fallbackValue),
          handleContinuedErrors: jest.fn().mockResolvedValue(undefined),
        },
      });

      const context = createLoggingContext(calls);
      const target = createFailingTestTarget<number>("target error");

      const result = await runProcess({ process, context, target });

      expect(result).toBe(fallbackValue);
      expect(calls).toContain("around:before-target");
      expect(calls).toContain("around:target-failed");
      expect(calls).toContain("afterThrowing:handled");
      // Note: afterReturning will execute for the fallback value after error resolution
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

  describe("Around Advice Features", () => {
    it("should handle attachToResult and attachToTarget simultaneously", async () => {
      const calls: string[] = [];

      const TestAspect = createAspect<number, StandardTestContext>(
        (createAdvice) => ({
          name: "dual-attach-test",
          around: createAdvice({
            use: ["log"],
            advice: async ({ log }, { attachToResult, attachToTarget }) => {
              // Attach to result - applied to the final wrapped target
              attachToResult((target) => async () => {
                log.info("result-wrapper-start");
                const result = await target();
                log.info("result-wrapper-end");
                return result * 2;
              });

              // Attach to target - applied to the original target
              attachToTarget((target) => async () => {
                log.info("target-wrapper-start");
                const result = await target();
                log.info("target-wrapper-end");
                return result + 10;
              });
            },
          }),
        }),
      );

      const result = await runWith<number, StandardTestContext>([TestAspect], {
        context: createLoggingContext(calls),
        target: createCommonTarget(5),
      });

      // Expected execution order based on current architecture:
      // resultWrapper(nextChain(targetWrapper(target)))
      expect(result).toBe(30); // ((5 + 10) * 2)
      expect(calls).toContain("result-wrapper-start");
      expect(calls).toContain("result-wrapper-end");
      expect(calls).toContain("target-wrapper-start");
      expect(calls).toContain("target-wrapper-end");
    });

    it("should handle multiple attachToTarget wrappers in correct order", async () => {
      const calls: string[] = [];

      const MultiWrapperAspect = createAspect<number, StandardTestContext>(
        (createAdvice) => ({
          name: "multi-wrapper",
          around: createAdvice({
            use: ["log"],
            advice: async ({ log }, { attachToTarget }) => {
              attachToTarget((target) => async () => {
                log.info("wrapper-1-start");
                const result = await target();
                log.info("wrapper-1-end");
                return result + 1;
              });

              attachToTarget((target) => async () => {
                log.info("wrapper-2-start");
                const result = await target();
                log.info("wrapper-2-end");
                return result * 3;
              });

              attachToTarget((target) => async () => {
                log.info("wrapper-3-start");
                const result = await target();
                log.info("wrapper-3-end");
                return result + 100;
              });
            },
          }),
        }),
      );

      const result = await runWith<number, StandardTestContext>(
        [MultiWrapperAspect],
        { context: createLoggingContext(calls), target: createCommonTarget(2) },
      );

      // Expected execution order: wrapper-3(wrapper-2(wrapper-1(target)))
      // wrapper-1(2) = 3, wrapper-2(3) = 9, wrapper-3(9) = 109
      expect(result).toBe(109);

      // Check execution order in logs
      const wrapperStartOrder = pickOrder(calls, "-start");
      const wrapperEndOrder = pickOrder(calls, "-end");

      expect(wrapperStartOrder).toEqual([
        "wrapper-3-start",
        "wrapper-2-start",
        "wrapper-1-start",
      ]);
      expect(wrapperEndOrder).toEqual([
        "wrapper-1-end",
        "wrapper-2-end",
        "wrapper-3-end",
      ]);
    });

    it("should handle complex async operations in wrappers", async () => {
      const calls: string[] = [];

      const AsyncAspect = createAspect<number, StandardTestContext>(
        (createAdvice) => ({
          name: "async-test",
          around: createAdvice({
            use: ["log"],
            advice: async ({ log }, { attachToResult, attachToTarget }) => {
              attachToResult((target) => async () => {
                log.info("async-result-start");
                await new Promise((resolve) => setTimeout(resolve, 1));
                const result = await target();
                await new Promise((resolve) => setTimeout(resolve, 1));
                log.info("async-result-end");
                return result + 1000;
              });

              attachToTarget((target) => async () => {
                log.info("async-target-start");
                const result = await target()
                  .then((r) => r + 5)
                  .then(async (r) => {
                    await new Promise((resolve) => setTimeout(resolve, 1));
                    return r * 2;
                  });
                log.info("async-target-end");
                return result;
              });
            },
          }),
        }),
      );

      const result = await runWith<number, StandardTestContext>([AsyncAspect], {
        context: createLoggingContext(calls),
        target: createCommonTarget(3),
      });

      // Expected: ((3 + 5) * 2) + 1000 = 16 + 1000 = 1016
      expect(result).toBe(1016);
      expect(calls).toContain("async-result-start");
      expect(calls).toContain("async-result-end");
      expect(calls).toContain("async-target-start");
      expect(calls).toContain("async-target-end");
    });

    it("should handle error scenarios with attachToTarget", async () => {
      const calls: string[] = [];

      const ErrorHandlingAspect = createAspect<number, StandardTestContext>(
        (createAdvice) => ({
          name: "error-handling",
          around: createAdvice({
            use: ["log"],
            advice: async ({ log }, { attachToTarget }) => {
              attachToTarget((target) => async () => {
                log.info("error-wrapper-start");
                try {
                  const result = await target();
                  log.info("error-wrapper-success");
                  return result + 50;
                } catch (error) {
                  log.info("error-wrapper-caught");
                  throw error;
                }
              });
            },
          }),
          afterThrowing: createAdvice({
            use: ["log"],
            advice: async ({ log }, error) => {
              log.info(
                `afterThrowing: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              );
            },
          }),
        }),
      );

      const expectedFallback = -1000;

      const result = await runWith<number, StandardTestContext>(
        [ErrorHandlingAspect],
        {
          context: createLoggingContext(calls),
          target: createFailingTestTarget("target error"),
          processOptions: {
            ...createFallbackProcessOptions<number, StandardTestContext>(),
            handleError: jest.fn().mockResolvedValue(expectedFallback),
          },
        },
      );

      expect(result).toBe(expectedFallback);
      expect(calls).toContain("error-wrapper-start");
      expect(calls).toContain("error-wrapper-caught");
      expect(calls.some((c) => c.includes("afterThrowing: target error"))).toBe(
        true,
      );
    });
  });
});
