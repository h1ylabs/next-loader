import type { HaltError } from "@/lib/errors/HaltError";
import type { AspectOrganization } from "@/lib/models/aspect";
import type { RequiredBuildOptions } from "@/lib/models/buildOptions";
import type { RequiredProcessOptions } from "@/lib/models/processOptions";
import type { Target } from "@/lib/models/target";

export type AdviceChainContext<Result, SharedContext> = {
  // collecting errors
  haltRejection?: HaltError;
  continueRejections: unknown[];

  // default context
  context: () => SharedContext;

  // infomation for advice chain
  target: Target<Result>;
  advices: AspectOrganization<Result, SharedContext>;
  buildOptions: RequiredBuildOptions;
  processOptions: RequiredProcessOptions<Result>;
};
