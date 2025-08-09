import { Target } from "@/lib/models/target";

import { processAroundAdvice } from "../processing/processAroundAdvice";
import { checkRejection, handleRejection } from "./adviceHandlers";
import type { AdviceChainContext } from "./context";

export function beforeAdviceTask<Result, SharedContext>(
  chain: () => AdviceChainContext<Result, SharedContext>,
) {
  return async () => {
    const beforeAdvice = async () => chain().advices.before(chain().context());

    return beforeAdvice().catch(handleRejection(chain));
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

    let targetWithAround: Target<Result> | (() => Promise<null>) = async () =>
      null;

    return Promise.resolve()
      .then(checkRejection(chain))
      .then(async () => (targetWithAround = aroundAdvice(chain().target)))
      .catch(handleRejection(chain))
      .then(() => targetWithAround);
  };
}

export function executeTargetTask<Result>(
  target: Target<Result> | (() => Promise<null>),
) {
  return target();
}

export function afterReturningAdviceTask<Result, SharedContext>(
  chain: () => AdviceChainContext<Result, SharedContext>,
) {
  return async (result: Result | null) => {
    const afterReturningAdvice = async () =>
      chain().advices.afterReturning(chain().context());

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
  return async (error: unknown) => {
    const afterThrowingAdvice = async () =>
      chain().advices.afterThrowing(chain().context(), error);

    return Promise.resolve()
      .then(checkRejection(chain))
      .then(afterThrowingAdvice)
      .catch(handleRejection(chain))
      .then(() => null);
  };
}

export function afterAdviceTask<Result, SharedContext>(
  chain: () => AdviceChainContext<Result, SharedContext>,
) {
  return async () => {
    const afterAdvice = async () => chain().advices.after(chain().context());

    return afterAdvice().catch(handleRejection(chain));
  };
}
