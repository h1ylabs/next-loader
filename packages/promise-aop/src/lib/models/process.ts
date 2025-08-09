import type { Target } from "./target";

export type Process<Result, SharedContext> = (
  context: () => SharedContext,
  target: Target<Result>,
) => Promise<Result | null>;
