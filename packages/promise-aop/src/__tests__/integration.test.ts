import { createAspect } from "@/createAspect";
import { createProcess } from "@/createProcess";
import { AdviceError } from "@/lib/errors/AdviceError";
import { organizeAspect } from "@/lib/features/organizing";
import type { Aspect } from "@/lib/models/aspect";
import { defaultBuildOptions } from "@/lib/models/buildOptions";
import type { Target } from "@/lib/models/target";
import { AsyncContext } from "@/lib/utils/AsyncContext";
import { runProcess } from "@/runProcess";

import { createLoggingContext, type StandardTestContext } from "./test-utils";

describe("integration", () => {
  type TestContext = StandardTestContext & {
    readonly aux?: { poke: () => void };
  };

  describe("basic flow", () => {
    it("should execute full lifecycle successfully", async () => {
      const calls: string[] = [];

      const LoggingAspect: Aspect<string, TestContext> = createAspect<
        string,
        TestContext
      >((createAdvice) => ({
        name: "logging",
        before: createAdvice({
          use: ["log"],
          advice: async ({ log }) => log.info("before"),
        }),
        around: createAdvice({
          use: ["log"],
          advice: async ({ log }, wrap) => {
            wrap((target) => async () => {
              log.info("around:before");
              const out = await target();
              log.info("around:after");
              return out;
            });
          },
        }),
        afterReturning: createAdvice({
          use: ["log"],
          advice: async ({ log }) => log.info("afterReturning"),
        }),
        after: createAdvice({
          use: ["log"],
          advice: async ({ log }) => log.info("after"),
        }),
      }));

      const onResolveContinuedError = jest.fn();
      const run = createProcess<string, TestContext>({
        aspects: [LoggingAspect],
        processOptions: {
          onResolveContinuedError,
        },
      });

      const context = createLoggingContext(calls);
      const target: Target<string> = async () => "OK";
      const result = await run(context, target);

      expect(result).toBe("OK");
      expect(calls).toEqual(
        expect.arrayContaining([
          "before",
          "around:before",
          "around:after",
          "afterReturning",
          "after",
        ]),
      );
      expect(onResolveContinuedError).toHaveBeenCalledWith([]);
    });
  });

  describe("halt handling", () => {
    it("should halt on before error, run afterThrowing/after, and return fallback", async () => {
      const calls: string[] = [];
      let targetCalled = false;

      const FailBeforeAspect: Aspect<string, TestContext> = createAspect<
        string,
        TestContext
      >((createAdvice) => ({
        name: "fail",
        before: createAdvice({
          use: ["log"],
          advice: async () => {
            throw new Error("boom");
          },
        }),
      }));

      const ObserverAspect: Aspect<string, TestContext> = createAspect<
        string,
        TestContext
      >((createAdvice) => ({
        name: "observer",
        after: createAdvice({
          use: ["log"],
          advice: async ({ log }) => log.info("after"),
        }),
        afterThrowing: createAdvice({
          use: ["log"],
          advice: async ({ log }) => log.info("afterThrowing"),
        }),
      }));

      const onResolveContinuedError = jest.fn();
      const run = createProcess<string, TestContext>({
        aspects: [FailBeforeAspect, ObserverAspect],
        processOptions: {
          onResolveError: async () => "FALLBACK",
          onResolveContinuedError,
        },
      });

      const context = createLoggingContext(calls);
      const target: Target<string> = async () => {
        targetCalled = true;
        return "SHOULD_NOT_RUN";
      };

      const result = await run(context, target);

      expect(result).toBe("FALLBACK");
      expect(targetCalled).toBe(false);
      expect(calls).toContain("after");
      expect(calls).not.toContain("afterThrowing");
      expect(onResolveContinuedError).toHaveBeenCalledWith([]);
    });
  });

  describe("continue handling", () => {
    it("should continue on after error and report collected errors", async () => {
      const calls: string[] = [];

      const AfterErrorAspect: Aspect<string, TestContext> = createAspect<
        string,
        TestContext
      >((createAdvice) => ({
        name: "afterError",
        after: createAdvice({
          use: ["log"],
          advice: async () => {
            throw new Error("after failed");
          },
        }),
      }));

      const onResolveContinuedError = jest.fn();
      const run = createProcess<string, TestContext>({
        aspects: [AfterErrorAspect],
        processOptions: {
          onResolveContinuedError,
        },
      });

      const context = createLoggingContext(calls);
      const target: Target<string> = async () => "OK";
      const result = await run(context, target);

      expect(result).toBe("OK");
      expect(onResolveContinuedError).toHaveBeenCalledTimes(1);
      const arg = onResolveContinuedError.mock.calls[0]?.[0];
      expect(Array.isArray(arg)).toBe(true);
      expect(arg.length).toBe(1);
      expect(arg[0]).toBeInstanceOf(AdviceError);
    });

    it("should continue when afterThrowing advice throws and keep null result while reporting error", async () => {
      const calls: string[] = [];

      const ThrowingInAfterThrowing = createAspect<string, TestContext>(
        (createAdvice) => ({
          name: "throwingAfterThrowing",
          afterThrowing: createAdvice({
            use: ["log"],
            advice: async () => {
              throw new Error("afterThrowing failed");
            },
          }),
          after: createAdvice({
            use: ["log"],
            advice: async ({ log }) => log.info("after"),
          }),
        }),
      );

      const onResolveContinuedError = jest.fn();
      const run = createProcess<string, TestContext>({
        aspects: [ThrowingInAfterThrowing],
        buildOptions: {
          advice: {
            afterThrowing: {
              error: {
                runtime: { afterThrow: "continue" },
              },
            },
          },
        },
        processOptions: {
          onResolveContinuedError,
        },
      });

      const context = createLoggingContext(calls);
      const target: Target<string> = async () => {
        throw new Error("target failed");
      };

      const result = await run(context, target);

      expect(result).toBeNull();
      // after should still run even if afterThrowing threw (continue policy)
      expect(calls).toContain("after");
      // should report exactly one AdviceError (from afterThrowing)
      expect(onResolveContinuedError).toHaveBeenCalledTimes(1);
      const reported = onResolveContinuedError.mock.calls[0]?.[0];
      expect(Array.isArray(reported)).toBe(true);
      expect(reported.length).toBe(1);
    });
  });

  describe("target throwing", () => {
    it("should return null and execute afterThrowing and after", async () => {
      const calls: string[] = [];

      const ObserverAspect: Aspect<string, TestContext> = createAspect<
        string,
        TestContext
      >((createAdvice) => ({
        name: "observer",
        afterThrowing: createAdvice({
          use: ["log"],
          advice: async ({ log }) => log.info("afterThrowing"),
        }),
        after: createAdvice({
          use: ["log"],
          advice: async ({ log }) => log.info("after"),
        }),
      }));

      const onResolveContinuedError = jest.fn();
      const run = createProcess<string, TestContext>({
        aspects: [ObserverAspect],
        processOptions: {
          onResolveContinuedError,
        },
      });

      const context = createLoggingContext(calls);
      const target: Target<string> = async () => {
        throw new Error("target failed");
      };

      const result = await run(context, target);

      expect(result).toBeNull();
      expect(calls).toEqual(expect.arrayContaining(["afterThrowing", "after"]));
      expect(onResolveContinuedError).toHaveBeenCalledWith([]);
    });
  });

  describe("dependsOn ordering", () => {
    it("should honor before dependsOn ordering across levels", async () => {
      const calls: string[] = [];

      const AspectA: Aspect<string, TestContext> = createAspect<
        string,
        TestContext
      >((createAdvice) => ({
        name: "A",
        before: createAdvice({
          use: ["log"],
          advice: async ({ log }) => log.info("A.before"),
        }),
      }));

      const AspectB: Aspect<string, TestContext> = createAspect<
        string,
        TestContext
      >((createAdvice) => ({
        name: "B",
        before: createAdvice({
          use: ["log"],
          dependsOn: ["A"],
          advice: async ({ log }) => log.info("B.before"),
        }),
      }));

      const run = createProcess<string, TestContext>({
        aspects: [AspectA, AspectB],
      });

      const context = createLoggingContext(calls);
      const target: Target<string> = async () => "OK";
      const result = await run(context, target);

      expect(result).toBe("OK");
      const aIdx = calls.indexOf("A.before");
      const bIdx = calls.indexOf("B.before");
      expect(aIdx).toBeGreaterThanOrEqual(0);
      expect(bIdx).toBeGreaterThanOrEqual(0);
      expect(aIdx).toBeLessThan(bIdx);
    });
  });

  describe("section conflict detection (organizing)", () => {
    it("should detect same-section usage at organizing stage for parallel before", async () => {
      const ConflictAspectA: Aspect<string, TestContext> = createAspect<
        string,
        TestContext
      >((createAdvice) => ({
        name: "ConfA",
        before: createAdvice({ use: ["log"], advice: async () => {} }),
      }));

      const ConflictAspectB: Aspect<string, TestContext> = createAspect<
        string,
        TestContext
      >((createAdvice) => ({
        name: "ConfB",
        before: createAdvice({ use: ["log"], advice: async () => {} }),
      }));

      await expect(
        organizeAspect<string, TestContext>({
          aspects: [ConflictAspectA, ConflictAspectB],
          buildOptions: defaultBuildOptions(),
        }),
      ).rejects.toThrow(/Section conflict:/);
    });
  });

  describe("global AsyncContext access (external helper)", () => {
    it("should allow external helper to use instance.context() without param wiring", async () => {
      const calls: string[] = [];

      const ExternalAccessAspect: Aspect<string, TestContext> = createAspect<
        string,
        TestContext
      >((createAdvice) => ({
        name: "external",
        before: createAdvice({
          advice: async () => {
            // external helper will read from global async context
            externalHelper();
          },
        }),
      }));

      const run = createProcess<string, TestContext>({
        aspects: [ExternalAccessAspect],
      });

      const ac = AsyncContext.create<TestContext>(createLoggingContext(calls));

      const externalHelper = () => {
        const { log } = ac.context();
        log.info("external:before");
      };

      const result = await runProcess({
        process: run,
        context: ac,
        target: async () => "OK",
      });

      expect(result).toBe("OK");
      expect(calls).toContain("external:before");
    });
  });
});
