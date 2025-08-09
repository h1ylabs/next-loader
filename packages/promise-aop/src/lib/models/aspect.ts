import type {
  Advice,
  AdviceFunctionWithContext,
  AdviceMetadata,
} from "./advice";

export type Aspect<Result, SharedContext> = { readonly name: string } & {
  readonly [AdviceType in Advice]?: AdviceMetadata<
    Result,
    SharedContext,
    AdviceType
  >;
};

export type AspectOrganization<Result, SharedContext> = {
  readonly [AdviceType in Advice]: AdviceFunctionWithContext<
    Result,
    SharedContext,
    AdviceType
  >;
};
