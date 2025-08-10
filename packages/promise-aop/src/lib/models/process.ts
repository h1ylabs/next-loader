import type { Target, TARGET_FALLBACK } from "./target";

export type Process<Result, SharedContext> = (
  context: () => SharedContext,
  target: Target<Result>,
) => Promise<Result | typeof TARGET_FALLBACK>;
