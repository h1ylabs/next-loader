import {
  CompositeTagParameters,
  CompositeTagResolver,
  CompositeTagResult,
  SingleTag,
  UnresolvedCompositeTag,
} from "./types";

export function compose<
  Tags extends readonly SingleTag[],
  Params extends CompositeTagParameters<Tags>,
  Result extends CompositeTagResult<Tags>,
  Resolver extends CompositeTagResolver<Tags, Params, Result>,
>(...tags: Tags): UnresolvedCompositeTag<Tags, Params, Result, Resolver> {
  if (tags.length === 0) {
    throw new Error("Error: at least a single tag required.");
  }

  function resolve(...params: Params) {
    let nonEmptyParamIdx = 0;
    const result = tags
      .map((tag) =>
        tag.resolved
          ? tag.result
          : tag.resolver(...params[nonEmptyParamIdx++]!).result,
      )
      .join("_");

    return {
      type: "composite",
      resolved: true,
      result,
    };
  }

  return {
    type: "composite",
    resolved: false,
    resolver: resolve as Resolver,
  };
}
