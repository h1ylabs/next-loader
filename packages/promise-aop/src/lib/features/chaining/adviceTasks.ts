import { HaltRejection } from "@/lib/models/rejection";
import type { AroundAdviceResolver, Target } from "@/lib/models/target";

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
    const resolve = await process({
      context: chain().context(),
      around: chain().advices.around,
    });

    const { handleAroundAdvice, resultAroundAdvice } = ((resolveAdvice) => {
      let resolver: AroundAdviceResolver<Result> = () => chain().target;

      return {
        handleAroundAdvice: () => (resolver = resolveAdvice(chain().target)),
        resultAroundAdvice: () => resolver,
      };
    })(resolve);

    return Promise.resolve()
      .then(checkRejection(chain))
      .then(handleAroundAdvice)
      .catch(handleRejection(chain))
      .then(resultAroundAdvice);
  };
}

export async function executeTargetTask<Result>(target: Target<Result>) {
  return target();
}

export function afterReturningAdviceTask<Result, SharedContext>(
  chain: () => AdviceChainContext<Result, SharedContext>,
) {
  return async (result: Result) => {
    const afterReturningAdvice = async () => {
      await chain().advices.afterReturning(chain().context(), result);
    };

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
    const afterThrowingAdvice = async () => {
      await chain().advices.afterThrowing(chain().context(), error);
    };

    // explicitly propagate the error from the target.
    const targetRejection = async () => {
      throw (chain().haltRejection = new HaltRejection([error], {
        occurredFrom: "target",
      }));
    };

    return (
      Promise.resolve()
        .then(checkRejection(chain))
        .then(afterThrowingAdvice)
        .catch(handleRejection(chain))
        // If not halted by upper stages, always propagate Target Error.
        .then(targetRejection)
    );
  };
}

export function afterAdviceTask<Result, SharedContext>(
  chain: () => AdviceChainContext<Result, SharedContext>,
) {
  return async () => {
    const afterAdvice = async () => {
      await chain().advices.after(chain().context());
    };

    return Promise.resolve().then(afterAdvice).catch(handleRejection(chain));
  };
}
