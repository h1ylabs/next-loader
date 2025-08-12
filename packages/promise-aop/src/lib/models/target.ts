export type Target<Result> = () => Promise<Result>;
export type TargetWrapper<Result> = (target: Target<Result>) => Target<Result>;
export type AroundAdviceResolver<Result> = (
  nextChain: TargetWrapper<Result>,
) => Target<Result>;

// fallback of the target
export const TARGET_FALLBACK = Symbol("PROMISE_AOP_TARGET_FALLBACK");

export type TargetFallback = Target<typeof TARGET_FALLBACK>;
export const TargetFallback: TargetFallback = async () => TARGET_FALLBACK;

export type AroundAdviceFallbackResolver = AroundAdviceResolver<
  typeof TARGET_FALLBACK
>;
export const AroundAdviceFallbackResolver: AroundAdviceFallbackResolver = (
  chain,
) => chain(TargetFallback);
