import { executeAdviceChain } from "@/lib/features/chaining";
import { organizeAspect } from "@/lib/features/organizing";
import type { Aspect } from "@/lib/models/aspect";
import {
  type BuildOptions,
  normalizeBuildOptions,
} from "@/lib/models/buildOptions";
import {
  normalizeProcessOptions,
  type ProcessOptions,
} from "@/lib/models/processOptions";
import type { Target } from "@/lib/models/target";

export function createProcess<Result, SharedContext>({
  aspects,
  buildOptions: optionalBuildOptions,
  processOptions: optionalProcessOptions,
}: __Props<Result, SharedContext>): __Return<Result, SharedContext> {
  const buildOptions = normalizeBuildOptions(optionalBuildOptions);
  const processOptions = normalizeProcessOptions(optionalProcessOptions);
  const advices = organizeAspect({ aspects, buildOptions });

  return async (context, target) =>
    executeAdviceChain<Result, SharedContext>({
      context,
      target,
      advices: await advices,
      buildOptions,
      processOptions,
    });
}

export type __Props<Result, SharedContext> = {
  readonly aspects: readonly Aspect<Result, SharedContext>[];
  readonly buildOptions?: BuildOptions;
  readonly processOptions?: ProcessOptions<Result>;
};

export type __Return<Result, SharedContext> = (
  context: () => SharedContext,
  target: Target<Result>,
) => Promise<Result | null>;
