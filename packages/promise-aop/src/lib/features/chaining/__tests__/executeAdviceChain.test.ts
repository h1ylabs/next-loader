import { createAspect } from "@/createAspect";
import { createProcess } from "@/createProcess";
import type { Target } from "@/lib/models/target";

type Ctx = { log: { info: (m: string) => void } };

describe("executeAdviceChain (focused)", () => {
  it("should return null when around advice throws and runtime is continue; after should run", async () => {
    const calls: string[] = [];

    const A = createAspect<number, Ctx>((createAdvice) => ({
      name: "A",
      around: createAdvice({
        use: ["log"],
        advice: async () => {
          throw new Error("wrapping failed");
        },
      }),
      after: createAdvice({
        use: ["log"],
        advice: async ({ log }) => log.info("after"),
      }),
    }));

    const run = createProcess<number, Ctx>({
      aspects: [A],
      buildOptions: {
        advice: {
          before: {
            execution: "parallel",
            error: { aggregation: "unit", runtime: { afterThrow: "halt" } },
          },
          around: {
            execution: "sequential",
            error: { aggregation: "unit", runtime: { afterThrow: "continue" } },
          },
          after: {
            execution: "parallel",
            error: { aggregation: "all", runtime: { afterThrow: "continue" } },
          },
          afterReturning: {
            execution: "parallel",
            error: { aggregation: "all", runtime: { afterThrow: "continue" } },
          },
          afterThrowing: {
            execution: "parallel",
            error: { aggregation: "all", runtime: { afterThrow: "halt" } },
          },
        },
      },
    });

    const result = await run(
      () => ({ log: { info: (m: string) => calls.push(m) } }),
      (async () => 123) as Target<number>,
    );

    expect(result).toBeNull();
    expect(calls).toContain("after");
  });

  it("should run afterThrowing and after when target throws; result is null", async () => {
    const calls: string[] = [];

    const Obs = createAspect<number, Ctx>((createAdvice) => ({
      name: "Obs",
      afterThrowing: createAdvice({
        use: ["log"],
        advice: async ({ log }) => log.info("afterThrowing"),
      }),
      after: createAdvice({
        use: ["log"],
        advice: async ({ log }) => log.info("after"),
      }),
    }));

    const run = createProcess<number, Ctx>({ aspects: [Obs] });

    const result = await run(
      () => ({ log: { info: (m: string) => calls.push(m) } }),
      (async () => {
        throw new Error("target failed");
      }) as Target<number>,
    );

    expect(result).toBeNull();
    expect(calls).toEqual(expect.arrayContaining(["afterThrowing", "after"]));
  });
});
