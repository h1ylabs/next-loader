import { AspectOrganization } from "@/lib/models/aspect";
import { RequiredBuildOptions } from "@/lib/models/buildOptions";
import { RequiredProcessOptions } from "@/lib/models/processOptions";
import { Target, TARGET_FALLBACK } from "@/lib/models/target";
import { AsyncContext } from "@/lib/utils/AsyncContext";

import {
  afterAdviceTask,
  afterReturningAdviceTask,
  afterThrowingAdviceTask,
  aroundAdviceTask,
  beforeAdviceTask,
  executeTargetTask,
} from "./adviceTasks";
import { AdviceChainContext } from "./context";
import {
  handleContinuousRejection,
  resolveHaltRejection,
} from "./rejectionHandlers";

export async function executeAdviceChain<Result, SharedContext>(
  props: __Props<Result, SharedContext>,
): Promise<__Return<Result>> {
  const AdviceChainContext = AsyncContext.create(
    (): AdviceChainContext<Result, SharedContext> => ({
      ...props,
      continueRejections: [],
    }),
  );

  return AsyncContext.execute(AdviceChainContext, async (chain) => {
    return (
      Promise.resolve()
        // advice tasks
        .then(beforeAdviceTask(chain))
        .then(aroundAdviceTask(chain))
        .then(executeTargetTask)
        .then(afterReturningAdviceTask(chain))
        .catch(afterThrowingAdviceTask(chain))
        .finally(afterAdviceTask(chain))
        // rejection handlers
        .catch(resolveHaltRejection(chain))
        .finally(handleContinuousRejection(chain))
    );
  });
}

export type __Props<Result, SharedContext> = {
  readonly target: Target<Result>;
  readonly context: () => SharedContext;
  readonly advices: AspectOrganization<Result, SharedContext>;
  readonly buildOptions: RequiredBuildOptions;
  readonly processOptions: RequiredProcessOptions<Result>;
};

export type __Return<Result> = Result | typeof TARGET_FALLBACK;
