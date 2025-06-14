import {
  CompositeTagParameters,
  CompositeTagResolver,
  CompositeTagResult,
  SingleTag,
  UnresolvedCompositeTag,
} from "./types";

export function compose<
  Tags extends readonly SingleTag[],
  Params extends CompositeTagParameters<Tags> = CompositeTagParameters<Tags>,
  Result extends CompositeTagResult<Tags> = CompositeTagResult<Tags>,
  Resolver extends CompositeTagResolver<
    Tags,
    Params,
    Result
  > = CompositeTagResolver<Tags, Params, Result>
>(...tags: Tags): UnresolvedCompositeTag<Tags, Params, Result, Resolver> {
  if (tags.length === 0) {
    throw new Error("Error: at least a single tag required.");
  }

  const resolver = ((...args: Params) => {
    let argIndex = 0;
    const results = tags.map((tag) =>
      tag.resolved
        ? tag.result
        : tag.resolver(...(args[argIndex++] as Parameters<typeof tag.resolver>))
            .result
    );

    return {
      type: "composite" as const,
      resolved: true as const,
      result: results.join("_") as Result,
    };
  }) as Resolver;

  return {
    type: "composite",
    resolved: false,
    resolver,
  };
}
