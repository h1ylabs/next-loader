import { AsyncLocalStorage } from "node:async_hooks";

import type { AdviceFunctionWithContext } from "@/lib/models/advice";
import type {
  AroundAdviceResolver,
  Target,
  TargetWrapper,
} from "@/lib/models/target";
import { AsyncContext } from "@/lib/utils/AsyncContext";

export async function processAroundAdvice<Result, SharedContext>({
  context,
  around,
}: __Props<Result, SharedContext>): Promise<__Return<Result>> {
  const ProcessContext = AsyncContext.create(
    (): __ProcessContext<Result> => ({
      attachToResult: [],
      attachToTarget: [],
    }),
  );

  return AsyncContext.execute(ProcessContext, async (process) => {
    // collect wrappers
    await around(context, {
      attachToResult(wrapper) {
        process().attachToResult.push(wrapper);
      },
      attachToTarget(wrapper) {
        process().attachToTarget.push(wrapper);
      },
    });

    const resultAttacher = process().attachToResult.reduce(
      (wrapper, current) => (target) => current(wrapper(target)),
      (target) => target,
    );

    const targetAttacher = process().attachToTarget.reduce(
      (wrapper, current) => (target) => current(wrapper(target)),
      (target) => target,
    );

    return (target) => (nextChain) => {
      const snapshot = AsyncLocalStorage.snapshot();

      return resultAttacher(snapshot(() => nextChain(targetAttacher(target))));
    };
  });
}

export type __ProcessContext<Result> = {
  readonly attachToResult: TargetWrapper<Result>[];
  readonly attachToTarget: TargetWrapper<Result>[];
};

export type __Return<Result> = (
  target: Target<Result>,
) => AroundAdviceResolver<Result>;

export type __Props<Result, SharedContext> = {
  readonly context: SharedContext;
  readonly around: AdviceFunctionWithContext<Result, SharedContext, "around">;
};
