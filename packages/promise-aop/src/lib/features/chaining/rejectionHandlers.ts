import { HaltError } from "@/lib/errors/HaltError";

import { AdviceChainContext } from "./context";

export function resolveHaltRejection<Result, SharedContext>(
  chain: () => AdviceChainContext<Result, SharedContext>,
) {
  return async (error: unknown) => {
    if (error instanceof HaltError) {
      return chain().processOptions.resolveHaltRejection(error);
    }

    throw error;
  };
}

export function handleContinuousRejection<Result, SharedContext>(
  chain: () => AdviceChainContext<Result, SharedContext>,
) {
  return async () => {
    chain().processOptions.resolveContinuousRejection(
      chain().continueRejections,
    );
  };
}
