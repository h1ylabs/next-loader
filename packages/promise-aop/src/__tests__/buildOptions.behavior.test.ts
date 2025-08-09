// comprehensive tests for BuildOptions combinations across phases
import { createAspect } from "@/createAspect";
import { createProcess } from "@/createProcess";
import type { Target } from "@/lib/models/target";

import { createLoggingContext, type StandardTestContext } from "./test-utils";

describe("buildOptions behavior (execution + runtime)", () => {
  describe("before phase", () => {
    it("parallel + halt: halts on error; target not executed", async () => {
      const calls: string[] = [];
      let targetCalled = false;

      const FailingAspect = createAspect<string, StandardTestContext>((a) => ({
        name: "A",
        before: a({
          advice: async () => {
            throw new Error("A.fail");
          },
        }),
      }));

      const LoggingAspect = createAspect<string, StandardTestContext>((a) => ({
        name: "B",
        before: a({
          use: ["log"],
          advice: async ({ log }) => {
            log.info("B.before");
          },
        }),
      }));

      const run = createProcess<string, StandardTestContext>({
        aspects: [FailingAspect, LoggingAspect],
        processOptions: {
          onResolveError: async () => "FALLBACK",
        },
      });

      const context = createLoggingContext(calls);
      const target: Target<string> = async () => {
        targetCalled = true;
        return "OK";
      };

      const result = await run(context, target);
      expect(result).toBe("FALLBACK");
      expect(targetCalled).toBe(false);
      expect(calls).toContain("B.before");
    });

    it("sequential + continue: continues and executes target", async () => {
      const calls: string[] = [];

      const FailingAspect = createAspect<string, StandardTestContext>((a) => ({
        name: "A",
        before: a({
          advice: async () => {
            throw new Error("A.fail");
          },
        }),
      }));

      const LoggingAspect = createAspect<string, StandardTestContext>((a) => ({
        name: "B",
        before: a({
          use: ["log"],
          advice: async ({ log }) => {
            log.info("B.before");
          },
        }),
      }));

      const run = createProcess<string, StandardTestContext>({
        aspects: [FailingAspect, LoggingAspect],
        buildOptions: {
          advice: {
            before: {
              execution: "sequential",
              error: {
                runtime: { afterThrow: "continue" },
              },
            },
          },
        },
      });

      const context = createLoggingContext(calls);
      const target: Target<string> = async () => "OK";

      const result = await run(context, target);
      expect(result).toBe("OK");
    });
  });

  describe("around phase", () => {
    it("sequential + continue: returns null when wrapper fails", async () => {
      const FailingAroundAspect = createAspect<string, StandardTestContext>(
        (a) => ({
          name: "A",
          around: a({
            use: ["log"],
            advice: async () => {
              throw new Error("wrap.fail");
            },
          }),
        }),
      );

      const run = createProcess<string, StandardTestContext>({
        aspects: [FailingAroundAspect],
        buildOptions: {
          advice: {
            around: {
              error: {
                runtime: { afterThrow: "continue" },
              },
            },
          },
        },
      });

      const result = await run(
        () => ({ log: { info: () => {} } }),
        async () => "OK",
      );
      expect(result).toBeNull();
    });

    it("sequential + halt: returns null in current chain behavior", async () => {
      const FailingAroundAspect = createAspect<string, StandardTestContext>(
        (a) => ({
          name: "A",
          around: a({
            use: ["log"],
            advice: async () => {
              throw new Error("wrap.fail");
            },
          }),
        }),
      );

      const run = createProcess<string, StandardTestContext>({
        aspects: [FailingAroundAspect],
        processOptions: {
          onResolveError: async () => "FALLBACK",
        },
      });

      const result = await run(
        () => ({ log: { info: () => {} } }),
        async () => "OK",
      );
      expect(result).toBeNull();
    });
  });

  describe("afterReturning / afterThrowing / after", () => {
    it("afterReturning parallel + continue: runs despite failure and keeps result", async () => {
      const calls: string[] = [];

      const FailingAfterReturningAspect = createAspect<
        string,
        StandardTestContext
      >((a) => ({
        name: "A",
        afterReturning: a({
          advice: async () => {
            throw new Error("A.ar.fail");
          },
        }),
      }));

      const LoggingAfterReturningAspect = createAspect<
        string,
        StandardTestContext
      >((a) => ({
        name: "B",
        afterReturning: a({
          use: ["log"],
          advice: async ({ log }) => {
            log.info("B.ar");
          },
        }),
      }));

      const run = createProcess<string, StandardTestContext>({
        aspects: [FailingAfterReturningAspect, LoggingAfterReturningAspect],
      });

      const result = await run(createLoggingContext(calls), async () => "OK");
      expect(result).toBe("OK");
      expect(calls).toContain("B.ar");
    });

    it("afterThrowing parallel + halt: runs and then halts handled by onResolveError", async () => {
      const calls: string[] = [];

      const FailingAfterThrowingAspect = createAspect<
        string,
        StandardTestContext
      >((a) => ({
        name: "A",
        afterThrowing: a({
          use: ["log"],
          advice: async ({ log }) => {
            log.info("A.at");
            throw new Error("AT.fail");
          },
        }),
      }));

      const run = createProcess<string, StandardTestContext>({
        aspects: [FailingAfterThrowingAspect],
        processOptions: {
          onResolveError: async () => "FALLBACK",
        },
      });

      const result = await run(createLoggingContext(calls), async () => {
        throw new Error("target");
      });
      expect(result).toBe("FALLBACK");
      expect(calls).toContain("A.at");
    });

    it("after parallel + continue: continues and keeps result", async () => {
      const FailingAfterAspect = createAspect<string, StandardTestContext>(
        (a) => ({
          name: "A",
          after: a({
            use: ["log"],
            advice: async () => {
              throw new Error("A.after.fail");
            },
          }),
        }),
      );

      const run = createProcess<string, StandardTestContext>({
        aspects: [FailingAfterAspect],
      });

      const result = await run(
        () => ({ log: { info: () => {} } }),
        async () => "OK",
      );
      expect(result).toBe("OK");
    });

    it("after aggregation=all + runtime:halt: collects all and halts via onResolveError", async () => {
      const calls: string[] = [];

      const FailingA = createAspect<string, StandardTestContext>((a) => ({
        name: "A",
        after: a({
          advice: async () => {
            throw new Error("A.after.fail");
          },
        }),
      }));

      const FailingB = createAspect<string, StandardTestContext>((a) => ({
        name: "B",
        after: a({
          advice: async () => {
            throw new Error("B.after.fail");
          },
        }),
      }));

      const run = createProcess<string, StandardTestContext>({
        aspects: [FailingA, FailingB],
        buildOptions: {
          advice: {
            after: {
              error: { aggregation: "all", runtime: { afterThrow: "halt" } },
            },
          },
        },
        processOptions: {
          onResolveError: async () => "FALLBACK",
        },
      });

      const result = await run(createLoggingContext(calls), async () => "OK");
      expect(result).toBe("FALLBACK");
    });
  });

  describe("aggregation: all vs unit", () => {
    it("before aggregation=all: collects errors and runtime policy decides final outcome", async () => {
      const FailingAspectA = createAspect<string, StandardTestContext>((a) => ({
        name: "A",
        before: a({
          advice: async () => {
            throw new Error("A");
          },
        }),
      }));
      const FailingAspectB = createAspect<string, StandardTestContext>((a) => ({
        name: "B",
        before: a({
          advice: async () => {
            throw new Error("B");
          },
        }),
      }));

      const runHalt = createProcess<string, StandardTestContext>({
        aspects: [FailingAspectA, FailingAspectB],
        buildOptions: {
          advice: {
            before: {
              error: { aggregation: "all" },
            },
          },
        },
        processOptions: {
          onResolveError: async () => "FALLBACK",
        },
      });

      const runContinue = createProcess<string, StandardTestContext>({
        aspects: [FailingAspectA, FailingAspectB],
        buildOptions: {
          advice: {
            before: {
              error: {
                aggregation: "all",
                runtime: { afterThrow: "continue" },
              },
            },
          },
        },
      });

      const ctx = () => ({ log: { info: () => {} } });

      const res1 = await runHalt(ctx, async () => "OK");
      expect(res1).toBe("FALLBACK");

      const res2 = await runContinue(ctx, async () => "OK");
      expect(res2).toBe("OK");
    });
  });
});
