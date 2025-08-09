/* eslint-disable @typescript-eslint/no-explicit-any */
import { createTestChain } from "@/__tests__/test-utils";
import { HaltError } from "@/lib/errors/HaltError";
import {
  handleContinueRejection,
  handleHaltRejection,
} from "@/lib/features/chaining/rejectionHandlers";

describe("rejectionHandlers", () => {
  it("handleHaltRejection should delegate to onResolveError when error is HaltError", async () => {
    const onResolveError = jest.fn(async (e: unknown) => ({
      handled: true,
      e,
    }));
    const chain = createTestChain<{ handled: boolean; e: unknown }, unknown>({
      processOptions: {
        onResolveError,
        onResolveContinuedError: jest.fn(),
      } as any,
    });
    const error = new HaltError(new Error("boom"));
    const handler = handleHaltRejection(chain);

    const result = await handler(error);

    expect(onResolveError).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ handled: true, e: error });
  });

  it("handleHaltRejection should rethrow unknown error types", async () => {
    const chain = createTestChain<null, unknown>();
    const handler = handleHaltRejection(chain);

    await expect(handler(new Error("not HaltError"))).rejects.toBeInstanceOf(
      Error,
    );
  });

  it("handleContinueRejection should call onResolveContinuedError with collected errors", async () => {
    const onResolveContinuedError = jest.fn();
    const chain = createTestChain<null, unknown>({
      continueRejections: ["a", "b"],
      processOptions: {
        onResolveError: jest.fn(),
        onResolveContinuedError,
      } as any,
    });
    const handler = handleContinueRejection(chain);

    await handler();

    expect(onResolveContinuedError).toHaveBeenCalledTimes(1);
    expect(onResolveContinuedError).toHaveBeenCalledWith(["a", "b"]);
  });
});
