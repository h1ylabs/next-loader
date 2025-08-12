import type { Target, TARGET_FALLBACK } from "./target";

export type Process<Result, SharedContext> = (
  context: () => SharedContext,
  exit: <T>(callback: () => T) => T,
  target: Target<Result>,
) => Promise<Result | typeof TARGET_FALLBACK>;
