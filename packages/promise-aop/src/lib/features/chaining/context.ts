import type { AspectOrganization } from "@/lib/models/aspect";
import type { RequiredBuildOptions } from "@/lib/models/buildOptions";
import type { RequiredProcessOptions } from "@/lib/models/processOptions";
import type {
  ContinuousRejection,
  HaltRejection,
} from "@/lib/models/rejection";
import type { Target } from "@/lib/models/target";
import {
  ContextAccessor,
  ExecutionOuterContext,
} from "@/lib/utils/AsyncContext";

export type AdviceChainContext<Result, SharedContext> = {
  // collecting errors
  haltRejection?: HaltRejection;
  continueRejections: ContinuousRejection[];

  // functions for AsyncContext
  context: ContextAccessor<SharedContext>;
  exit: ExecutionOuterContext;

  // options for AdviceChain
  target: Target<Result>;
  advices: AspectOrganization<Result, SharedContext>;
  buildOptions: RequiredBuildOptions;
  processOptions: RequiredProcessOptions<Result, SharedContext>;
};
