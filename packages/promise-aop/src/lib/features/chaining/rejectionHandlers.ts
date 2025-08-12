import { HaltError } from "@/lib/errors/HaltError";

import { AdviceChainContext } from "./context";

export function resolveHaltRejection<Result, SharedContext>(
  chain: () => AdviceChainContext<Result, SharedContext>,
) {
  return async (error: unknown) => {
    if (error instanceof HaltError) {
      const fallback = await chain().processOptions.resolveHaltRejection(
        chain().context,
        chain().exit,
        error.cause,
      );

      return fallback();
    }

    throw error;
  };
}

export function handleContinuousRejection<Result, SharedContext>(
  chain: () => AdviceChainContext<Result, SharedContext>,
) {
  return async () => {
    chain().processOptions.resolveContinuousRejection(
      chain().context,
      chain().exit,
      chain().continueRejections,
    );
  };
}
