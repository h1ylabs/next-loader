import { HaltError } from "@/lib/errors/HaltError";

import { AdviceChainContext } from "./context";

export function handleHaltRejection<Result, SharedContext>(
  chain: () => AdviceChainContext<Result, SharedContext>,
) {
  return async (error: unknown) => {
    if (error instanceof HaltError) {
      return chain().processOptions.onResolveError(error);
    }

    throw error;
  };
}

export function handleContinueRejection<Result, SharedContext>(
  chain: () => AdviceChainContext<Result, SharedContext>,
) {
  return async () => {
    chain().processOptions.onResolveContinuedError(chain().continueRejections);
  };
}
