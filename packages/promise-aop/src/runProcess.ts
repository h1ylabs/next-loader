import type { Process } from "@/lib/models/process";
import type { Target } from "@/lib/models/target";
import { AsyncContext, ContextGenerator } from "@/lib/utils/AsyncContext";

export async function runProcess<Result, SharedContext>({
  process,
  context,
  target,
}: __RunProcessProps<Result, SharedContext>) {
  const asyncContext =
    typeof context === "function" ? AsyncContext.create(context) : context;

  return AsyncContext.execute(asyncContext, async (ctx, exit) =>
    process(ctx, exit, target),
  );
}

export async function runProcessWith<Result, SharedContext>({
  process,
  context,
  contextGenerator,
  target,
}: __RunProcessWithProps<Result, SharedContext>) {
  return AsyncContext.executeWith(
    context,
    contextGenerator,
    async (ctx, exit) => process(ctx, exit, target),
  );
}

export type __RunProcessProps<Result, SharedContext> = {
  readonly process: Process<Result, SharedContext>;
  readonly context:
    | ContextGenerator<SharedContext>
    | AsyncContext<SharedContext>;
  readonly target: Target<Result>;
};

export type __RunProcessWithProps<Result, SharedContext> = {
  readonly process: Process<Result, SharedContext>;
  readonly context: AsyncContext<SharedContext>;
  readonly contextGenerator: ContextGenerator<SharedContext>;
  readonly target: Target<Result>;
};

export type __Return<Result, SharedContext> = ReturnType<
  Process<Result, SharedContext>
>;
