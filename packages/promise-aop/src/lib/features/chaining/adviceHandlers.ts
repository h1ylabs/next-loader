import { ErrorAfter } from "@/lib/models/buildOptions";
import {
  ContinuousRejection,
  HaltRejection,
  Rejection,
} from "@/lib/models/rejection";
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
    // if error is halt rejection, continue propagating
    if (error instanceof HaltRejection) {
      throw error;
    }

    // if rejection is thrown from advice, handle rejection
    else if (
      error instanceof Rejection &&
      error.info.occurredFrom === "advice"
    ) {
      const afterThrow = validateType(
        ErrorAfter,
        chain().buildOptions.advice[error.info.advice].error.runtime.afterThrow,
      );

      switch (afterThrow) {
        // halt the total advice chain
        case "halt":
          chain().haltRejection = new HaltRejection(error.errors, error.info);
          break;
        // continue the advice chain
        case "continue":
          chain().continueRejections.push(
            new ContinuousRejection(error.errors, error.info),
          );
          break;
        default:
          exhaustiveCheckType(afterThrow);
      }
    }

    // if error is unknown, halt immediately
    else {
      chain().haltRejection = new HaltRejection([error], {
        occurredFrom: "unknown",
      });
    }

    // if there is a halted rejection, propagate it
    await checkRejection(chain)();
  };
}
