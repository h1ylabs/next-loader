import { AdviceError } from "@/lib/errors/AdviceError";
import { HaltError } from "@/lib/errors/HaltError";
import { UnknownError } from "@/lib/errors/UnknownError";
import { ErrorAfter } from "@/lib/models/buildOptions";
import { exhaustiveCheckType, validateType } from "@/lib/utils/validateType";

import type { AdviceChainContext } from "./context";

export function checkRejection<Result, SharedContext>(
  chain: () => AdviceChainContext<Result, SharedContext>,
) {
  return async () => {
    if (chain().haltRejection) {
      throw chain().haltRejection;
    }
  };
}

export function handleRejection<Result, SharedContext>(
  chain: () => AdviceChainContext<Result, SharedContext>,
) {
  return async (error: unknown) => {
    // 1. if error is halted error propagated, continue propagating
    if (error instanceof HaltError) {
      throw error;
    }

    // 2. if error is thrown from advice, handle error
    else if (error instanceof AdviceError) {
      const afterThrow = validateType(
        ErrorAfter,
        chain().buildOptions.advice[error.advice].error.runtime.afterThrow,
      );

      switch (afterThrow) {
        // halt the total advice chain
        case "halt":
          chain().haltRejection = new HaltError(error);
          break;
        // continue the advice chain
        case "continue":
          chain().continueRejections.push(error);
          break;
        default:
          exhaustiveCheckType(afterThrow);
      }
    }

    // 4. if error is unknown, halt immediately
    else {
      chain().haltRejection = new HaltError(new UnknownError(error));
    }

    // if there is a halted error, propagate
    await checkRejection(chain)();
  };
}
