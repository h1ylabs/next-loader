import type { Restricted, SectionsUsed } from "@/lib/utils/RestrictedContext";

import type { TargetWrapper } from "./target";

export const Advice = [
  "before",
  "after",
  "around",
  "afterReturning",
  "afterThrowing",
] as const;

export type Advice = (typeof Advice)[number];

export type AdviceFunction<
  Result,
  AdviceType extends Advice,
> = AdviceFunctionMappings<Result>[AdviceType];

export type AdviceFunctionWithContext<
  Result,
  SharedContext,
  AdviceType extends Advice,
> = (
  context: SharedContext,
  ...args: Parameters<AdviceFunction<Result, AdviceType>>
) => ReturnType<AdviceFunction<Result, AdviceType>>;

export type AdviceMetadata<
  Result,
  SharedContext,
  AdviceType extends Advice,
  Sections extends SectionsUsed<SharedContext> = SectionsUsed<SharedContext>,
> = {
  readonly use?: Sections;
  readonly dependsOn?: readonly string[];
  readonly advice: AdviceFunctionWithContext<
    Result,
    Restricted<SharedContext, Sections>,
    AdviceType
  >;
};

export type AdviceExecution<
  Result,
  SharedContext,
  AdviceType extends Advice,
> = AdviceMetadata<Result, SharedContext, AdviceType>[][];

// advice function must be async & void function
type CheckAdviceFn<T> = T extends (...args: never) => Promise<void> ? T : never;

type AdviceFunctionMappings<Result> = {
  before: CheckAdviceFn<() => Promise<void>>;
  around: CheckAdviceFn<
    ({
      attachToResult,
      attachToTarget,
    }: {
      // Advice Chain을 결과물에 부착
      attachToResult: (wrapper: TargetWrapper<Result>) => void;
      // Advice Chain을 결과물 내 Target에 부착
      attachToTarget: (wrapper: TargetWrapper<Result>) => void;
    }) => Promise<void>
  >;
  afterReturning: CheckAdviceFn<(result: Result) => Promise<void>>;
  afterThrowing: CheckAdviceFn<(error: unknown) => Promise<void>>;
  after: CheckAdviceFn<() => Promise<void>>;
};
