import { HaltRejection } from "@/lib/models/rejection";

import { AdviceChainContext } from "./context";

export function resolveHaltRejection<Result, SharedContext>(
  chain: () => AdviceChainContext<Result, SharedContext>,
) {
  return async (error: unknown) => {
    if (!(error instanceof HaltRejection)) {
      throw error;
    }

    // determine which error to propagate
    const determinedError = await chain().processOptions.determineError({
      context: chain().context,
      exit: chain().exit,
      errors: error.errors,
      info: error.info,
    });

    // handle the error
    return chain().processOptions.handleError({
      context: chain().context,
      exit: chain().exit,
      error: determinedError,
    });
  };
}

export function handleContinuousRejection<Result, SharedContext>(
  chain: () => AdviceChainContext<Result, SharedContext>,
) {
  return async () =>
    chain().processOptions.handleContinuedErrors({
      context: chain().context,
      exit: chain().exit,
      errors: chain().continueRejections.map((rejection) => [
        rejection.errors,
        rejection.info,
      ]),
    });
}
