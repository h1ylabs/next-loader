import { AdviceFunctionWithContext } from "@/lib/models/advice";
import { TargetWrapper } from "@/lib/models/target";
import { AsyncContext } from "@/lib/utils/AsyncContext";

export async function processAroundAdvice<Result, SharedContext>({
  context,
  around,
}: __Props<Result, SharedContext>): Promise<__Return<Result>> {
  const ProcessContext = AsyncContext.create(
    (): __ProcessContext<Result> => ({ wrappers: [] }),
  );

  return AsyncContext.execute(ProcessContext, async (process) => {
    // collect wrappers
    await around(context, (wrapper) => {
      process().wrappers.push(wrapper);
    });

    // processing wrappers
    return process().wrappers.reduce(
      (wrapper, current) => (target) => current(wrapper(target)),
      (target) => target,
    );
  });
}

export type __ProcessContext<Result> = {
  readonly wrappers: TargetWrapper<Result>[];
};

export type __Return<Result> = TargetWrapper<Result>;

export type __Props<Result, SharedContext> = {
  readonly context: SharedContext;
  readonly around: AdviceFunctionWithContext<Result, SharedContext, "around">;
};
