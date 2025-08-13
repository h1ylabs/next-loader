import type { AspectOrganization } from "@/lib/models/aspect";
import type { RequiredBuildOptions } from "@/lib/models/buildOptions";
import type { RequiredProcessOptions } from "@/lib/models/processOptions";
import type { Target } from "@/lib/models/target";
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
  props: __Props<Result, SharedContext>
): Promise<__Return<Result>> {
  const AdviceChainContext = AsyncContext.create(
    (): AdviceChainContext<Result, SharedContext> => ({
      ...props,
      continueRejections: [],
    })
  );

  return AsyncContext.execute(AdviceChainContext, async (chain) => {
    return (
      Promise.resolve()
        .then(beforeAdviceTask(chain))
        .then(aroundAdviceTask(chain))
        .then((resolve) =>
          resolve(
            (target) => async () =>
              target()
                .then(afterReturningAdviceTask(chain))
                .catch(afterThrowingAdviceTask(chain))
                .finally(afterAdviceTask(chain))
                .catch(resolveHaltRejection(chain))
                .finally(handleContinuousRejection(chain))
          )
        )
        .then(executeTargetTask)
        // recover from halt error that occurred in upper stages (before/around etc.)
        .catch(resolveHaltRejection(chain))
        .finally(handleContinuousRejection(chain))
    );
  });
}

export type __Props<Result, SharedContext> = {
  readonly target: Target<Result>;
  readonly context: () => SharedContext;
  readonly exit: <T>(callback: () => T) => T;
  readonly advices: AspectOrganization<Result, SharedContext>;
  readonly buildOptions: RequiredBuildOptions;
  readonly processOptions: RequiredProcessOptions<Result, SharedContext>;
};

export type __Return<Result> = Result;
