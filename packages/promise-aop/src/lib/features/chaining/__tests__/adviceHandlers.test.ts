/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-object-type */
import { createTestChain } from "@/__tests__/test-utils";
import { AdviceError } from "@/lib/errors/AdviceError";
import { HaltError } from "@/lib/errors/HaltError";
import { UnknownHaltError } from "@/lib/errors/UnknownHaltError";
import {
  checkRejection,
  handleRejection,
} from "@/lib/features/chaining/adviceHandlers";

describe("adviceHandlers", () => {
  describe("handleRejection", () => {
    it("should convert AdviceError with runtime:halt into HaltError and throw via checkRejection", async () => {
      const chain = createTestChain<null, {}>();
      const h = handleRejection(chain);

      await expect(
        h(new AdviceError("before", [new Error("boom")])),
      ).rejects.toBeInstanceOf(HaltError);

      await expect(checkRejection(chain)()).rejects.toBeInstanceOf(HaltError);
    });

    it("should push AdviceError into continueRejections when runtime:continue and not throw", async () => {
      const chain = createTestChain<null, {}>({
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

      const h = handleRejection(chain);

      await expect(
        h(new AdviceError("before", [new Error("oops")])),
      ).resolves.toBeUndefined();

      expect(chain().continueRejections).toHaveLength(1);
      await expect(checkRejection(chain)()).resolves.toBeUndefined();
    });

    it("should convert unknown error into UnknownHaltError and throw", async () => {
      const chain = createTestChain<null, {}>();
      const h = handleRejection(chain);

      await expect(h("string-error")).rejects.toBeInstanceOf(UnknownHaltError);
      await expect(checkRejection(chain)()).rejects.toBeInstanceOf(
        UnknownHaltError,
      );
    });
  });
});
