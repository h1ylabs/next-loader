import { TargetError } from "@/lib/errors/TargetError";
import { Target, TARGET_FALLBACK, TargetFallback } from "@/lib/models/target";

import { processAroundAdvice } from "../processing/processAroundAdvice";
import { checkRejection, handleRejection } from "./adviceHandlers";
import type { AdviceChainContext } from "./context";

export function beforeAdviceTask<Result, SharedContext>(
  chain: () => AdviceChainContext<Result, SharedContext>,
) {
  return async () => {
    const beforeAdvice = async () => chain().advices.before(chain().context());

    return Promise.resolve().then(beforeAdvice).catch(handleRejection(chain));
  };
}

export function aroundAdviceTask<Result, SharedContext>(
  chain: () => AdviceChainContext<Result, SharedContext>,
  process = processAroundAdvice,
) {
  return async () => {
    const aroundAdvice = await process({
      context: chain().context(),
      around: chain().advices.around,
    });

    const { handleAroundAdvice, resultAroundAdvice } = ((aroundAdvice) => {
      let target: Target<Result> | TargetFallback = TargetFallback;

      return {
        handleAroundAdvice: () => (target = aroundAdvice(chain().target)),
        resultAroundAdvice: () => target,
      };
    })(aroundAdvice);

    return Promise.resolve()
      .then(checkRejection(chain))
      .then(handleAroundAdvice)
      .catch(handleRejection(chain))
      .then(resultAroundAdvice);
  };
}

export function executeTargetTask<Result>(
  target: Target<Result> | TargetFallback,
): Promise<Result | typeof TARGET_FALLBACK> {
  return target();
}

export function afterReturningAdviceTask<Result, SharedContext>(
  chain: () => AdviceChainContext<Result, SharedContext>,
) {
  return async (result: Result | typeof TARGET_FALLBACK) => {
    const afterReturningAdvice = async () =>
      chain().advices.afterReturning(chain().context());

    if (result === TARGET_FALLBACK) {
      return Promise.resolve()
        .then(checkRejection(chain))
        .then(() => result);
    }

    return Promise.resolve()
      .then(checkRejection(chain))
      .then(afterReturningAdvice)
      .catch(handleRejection(chain))
      .then(() => result);
  };
}

export function afterThrowingAdviceTask<Result, SharedContext>(
  chain: () => AdviceChainContext<Result, SharedContext>,
) {
  return async (error: unknown): Promise<typeof TARGET_FALLBACK> => {
    const afterThrowingAdvice = async () => {
      chain().advices.afterThrowing(chain().context(), error);
    };

    // explicitly propagate the error from the target.
    const targetRejection = async () => {
      throw new TargetError(error);
    };

    return (
      Promise.resolve()
        .then(checkRejection(chain))
        // if an error occurs during AfterThrowing, that error takes precedence.
        .then(afterThrowingAdvice)
        .then(targetRejection)
        .catch(handleRejection(chain))
        .then(TargetFallback)
    );
  };
}

export function afterAdviceTask<Result, SharedContext>(
  chain: () => AdviceChainContext<Result, SharedContext>,
) {
  return async () => {
    const afterAdvice = async () => chain().advices.after(chain().context());

    return Promise.resolve().then(afterAdvice).catch(handleRejection(chain));
  };
}
