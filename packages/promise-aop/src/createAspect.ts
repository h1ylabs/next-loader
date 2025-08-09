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

/**
 * Creates an Aspect by providing a helper function that generates advice metadata.
 *
 * This function serves as a factory for creating aspects in the AOP framework.
 * It takes an AspectGeneratorHelper function which receives an AdviceGeneratorHelper
 * that can be used to create and configure advice metadata with proper type safety.
 *
 * @template Result - The return type of functions that will be advised by this aspect
 * @template SharedContext - The type of shared context available across advice
 * @param helper - A function that receives an advice generator helper and returns an aspect
 * @returns An Aspect that can be applied to functions to provide cross-cutting concerns
 *
 * @example
 * ```typescript
 * const loggingAspect = createAspect<string, { logger: Logger }>((a) => ({
 *   name: 'logging',
 *   before: a({
 *     use: ['logger'],
 *     advice: async ({ logger }) => {
 *       logger.info('Starting execution');
 *     }
 *   }),
 *   after: a({
 *     use: ['logger'],
 *     advice: async ({ logger }) => {
 *       logger.info('Execution completed');
 *     }
 *   })
 * }));
 * ```
 */
export function createAspect<Result, SharedContext>(
  helper: AspectGeneratorHelper<Result, SharedContext>,
): Aspect<Result, SharedContext> {
  return helper((generator) => generator);
}
