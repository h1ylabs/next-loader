import { HaltRejection } from "@/lib/models/rejection";

import { AdviceChainContext } from "./context";

export function resolveHaltRejection<Result, SharedContext>(
  chain: () => AdviceChainContext<Result, SharedContext>
) {
  return async (error: unknown) => {
    if (error instanceof HaltRejection) {
      const fallback = await chain().processOptions.resolveHaltRejection(
        chain().context,
        chain().exit,
        error
      );

      return fallback();
    }

    throw error;
  };
}

export function handleContinuousRejection<Result, SharedContext>(
  chain: () => AdviceChainContext<Result, SharedContext>
) {
  return async () => {
    await chain().processOptions.resolveContinuousRejection(
      chain().context,
      chain().exit,
      chain().continueRejections
    );
  };
}
