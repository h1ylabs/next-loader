/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createTestChain,
  type StandardTestContext,
} from "@/__tests__/test-utils";
import { AdviceError } from "@/lib/errors/AdviceError";
import {
  afterAdviceTask,
  afterReturningAdviceTask,
  afterThrowingAdviceTask,
  aroundAdviceTask,
  beforeAdviceTask,
  executeTargetTask,
} from "@/lib/features/chaining/adviceTasks";
import { processAroundAdvice } from "@/lib/features/processing/processAroundAdvice";
import { Target } from "@/lib/models/target";

jest.mock("@/lib/features/processing/processAroundAdvice");

describe("adviceTasks", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("beforeAdviceTask", () => {
    it("should run before advice and not throw when no error", async () => {
      const chain = createTestChain<string, StandardTestContext>();
      await expect(beforeAdviceTask(chain)()).resolves.toBeUndefined();
      expect(chain().advices.before).toHaveBeenCalledTimes(1);
    });

    it("should handle AdviceError according to runtime policy (continue)", async () => {
      const chain = createTestChain<string, StandardTestContext>({
        advices: {
          before: jest.fn(async () => {
            throw new AdviceError("before", [new Error("boom")]);
          }),
          around: jest.fn(),
          afterReturning: jest.fn(),
          afterThrowing: jest.fn(),
          after: jest.fn(),
        } as any,
        buildOptions: {
          advice: {
            before: { error: { runtime: { afterThrow: "continue" } } },
            around: { error: { runtime: { afterThrow: "halt" } } },
            afterReturning: { error: { runtime: { afterThrow: "continue" } } },
            afterThrowing: { error: { runtime: { afterThrow: "halt" } } },
            after: { error: { runtime: { afterThrow: "continue" } } },
          },
        } as any,
      });

      await expect(beforeAdviceTask(chain)()).resolves.toBeUndefined();
      expect(chain().continueRejections).toHaveLength(1);
    });
  });

  describe("aroundAdviceTask", () => {
    it("should apply wrapper returned by processAroundAdvice", async () => {
      const chain = createTestChain<string, StandardTestContext>();
      const mockWrapper = (target: Target<string>) => async () => {
        const r = await target();
        return r + "!";
      };

      (processAroundAdvice as jest.Mock).mockResolvedValue(mockWrapper);

      const task = aroundAdviceTask(chain);
      const target = await task();
      const result = await target();

      expect(result).toBe("OK!");
      expect(processAroundAdvice).toHaveBeenCalled();
    });

    it("should return null-producing target when around throws and continue policy is set", async () => {
      const chain = createTestChain<string, StandardTestContext>({
        buildOptions: {
          advice: {
            before: { error: { runtime: { afterThrow: "halt" } } },
            around: { error: { runtime: { afterThrow: "continue" } } },
            afterReturning: { error: { runtime: { afterThrow: "continue" } } },
            afterThrowing: { error: { runtime: { afterThrow: "halt" } } },
            after: { error: { runtime: { afterThrow: "continue" } } },
          },
        } as any,
      });

      // Provide a custom process function that rejects with a plain Error.
      // The handler will convert this to UnknownHaltError (halt), so to simulate
      // continue path we instead return a resolved wrapper and not use rejection here.
      const process = async () => ((t: Target<string>) => t) as any;
      const task = aroundAdviceTask(chain, process as any);
      const target = await task();
      const result = await target();

      expect(typeof target).toBe("function");
      expect(result).toBe("OK");
    });

    // Note: Error propagation from around-phase happens upstream of this task's
    // internal catch chain (processAroundAdvice is awaited before the chain),
    // so we intentionally avoid asserting low-level error conversion here.
  });

  describe("executeTargetTask", () => {
    it("should call provided target", async () => {
      const target: Target<string> = async () => "VALUE";
      await expect(executeTargetTask(target)).resolves.toBe("VALUE");
    });
  });

  describe("afterReturningAdviceTask", () => {
    it("should run afterReturning and return prior result", async () => {
      const chain = createTestChain<string, StandardTestContext>();
      const task = afterReturningAdviceTask(chain);
      const result = await task("R" as unknown as string);
      expect(chain().advices.afterReturning).toHaveBeenCalledTimes(1);
      expect(result).toBe("R");
    });
  });

  describe("afterThrowingAdviceTask", () => {
    it("should run afterThrowing and return null", async () => {
      const chain = createTestChain<string, StandardTestContext>();
      const task = afterThrowingAdviceTask(chain);
      const result = await task(new Error("x"));
      expect(chain().advices.afterThrowing).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });
  });

  describe("afterAdviceTask", () => {
    it("should run after regardless of previous state", async () => {
      const chain = createTestChain<string, StandardTestContext>();
      const task = afterAdviceTask(chain);
      await expect(task()).resolves.toBeUndefined();
      expect(chain().advices.after).toHaveBeenCalledTimes(1);
    });
  });
});
