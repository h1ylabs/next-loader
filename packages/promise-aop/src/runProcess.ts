import type { Process } from "@/lib/models/process";
import type { Target } from "@/lib/models/target";
import { AsyncContext } from "@/lib/utils/AsyncContext";

export async function runProcess<Result, SharedContext>({
  process,
  context,
  target,
}: __Props<Result, SharedContext>) {
  const asyncContext =
    typeof context === "function" ? AsyncContext.create(context) : context;

  return AsyncContext.execute(asyncContext, async (ctx, exit) =>
    process(ctx, exit, target),
  );
}

export type __Props<Result, SharedContext> = {
  readonly process: Process<Result, SharedContext>;
  readonly context: (() => SharedContext) | AsyncContext<SharedContext>;
  readonly target: Target<Result>;
};

export type __Return<Result, SharedContext> = ReturnType<
  Process<Result, SharedContext>
>;
