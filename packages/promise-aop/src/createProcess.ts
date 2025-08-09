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

/**
 * Creates a process function that organizes aspects into an optimized execution chain.
 *
 * This function combines multiple aspects and their advice into a single executable process
 * that can be applied to target functions. It handles aspect organization, dependency resolution,
 * execution strategy configuration, and error handling.
 *
 * @template Result - The return type of target functions that will be processed
 * @template SharedContext - The type of shared context available across all advice
 *
 * @param config - Configuration object for process creation
 * @param config.aspects - Array of aspects to compose into the execution chain
 * @param config.buildOptions - Optional execution strategies and error handling per advice type
 * @param config.processOptions - Optional global process-level error handling configuration
 *
 * @returns A process function that takes context factory and target, returns Promise<Result | null>
 *
 * @example
 * ```typescript
 * // Basic usage with aspects
 * const run = createProcess({
 *   aspects: [LoggingAspect, CacheAspect, AuthAspect]
 * });
 *
 * // Execute with AsyncContext
 * const context = () => ({ logger: console, cache: redisClient });
 * const target = async () => ({ data: 'processed' });
 *
 * const ac = AsyncContext.create(context);
 * const result = await AsyncContext.execute(ac, (getCtx) => run(getCtx, target));
 * ```
 *
 * @example
 * ```typescript
 * // Advanced configuration with build and process options
 * const run = createProcess({
 *   aspects: [ValidationAspect, MetricsAspect],
 *   buildOptions: {
 *     advice: {
 *       before: {
 *         execution: 'sequential',
 *         error: { aggregation: 'unit', runtime: { afterThrow: 'halt' } }
 *       },
 *       after: {
 *         execution: 'parallel',
 *         error: { aggregation: 'all', runtime: { afterThrow: 'continue' } }
 *       }
 *     }
 *   },
 *   processOptions: {
 *     onResolveError: async (haltError) => ({ fallback: true }),
 *     onResolveContinuedError: (errors) => console.warn('Non-critical errors:', errors)
 *   }
 * });
 * ```
 */
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
