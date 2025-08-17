import type { Advice, AdviceMetadata } from "@/lib/models/advice";
import type { Aspect } from "@/lib/models/aspect";
import type { SectionsUsed } from "@/lib/utils/RestrictedContext";

type AdviceGeneratorHelper<Result, SharedContext> = <
  const Sections extends SectionsUsed<SharedContext>,
  AdviceType extends Advice,
>(
  advice: AdviceMetadata<Result, SharedContext, AdviceType, Sections>,
) => AdviceMetadata<Result, SharedContext, AdviceType, Sections>;

type AspectGeneratorHelper<Result, SharedContext> = (
  helper: AdviceGeneratorHelper<Result, SharedContext>,
) => Aspect<Result, SharedContext>;

export function createAspect<Result, SharedContext>(
  helper: AspectGeneratorHelper<Result, SharedContext>,
): Aspect<Result, SharedContext> {
  return helper((generator) => generator);
}
