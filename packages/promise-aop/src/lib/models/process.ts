import type {
  ContextAccessor,
  ExecutionOuterContext,
} from "@/lib/utils/AsyncContext";

import type { Target } from "./target";

export type Process<Result, SharedContext> = (
  context: ContextAccessor<SharedContext>,
  exit: ExecutionOuterContext,
  target: Target<Result>,
) => Promise<Result>;
