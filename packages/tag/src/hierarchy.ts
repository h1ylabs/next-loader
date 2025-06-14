import {
  HierarchyTagParameters,
  HierarchyTagResolver,
  HierarchyTagResult,
  SingleTag,
  UnresolvedHierarchyTag,
} from "./types";

export function hierarchy<
  Tags extends readonly SingleTag[],
  Params extends HierarchyTagParameters<Tags> = HierarchyTagParameters<Tags>,
  Result extends HierarchyTagResult<Tags> = HierarchyTagResult<Tags>,
  Resolver extends HierarchyTagResolver<
    Tags,
    Params,
    Result
  > = HierarchyTagResolver<Tags, Params, Result>
>(...tags: Tags): UnresolvedHierarchyTag<Tags, Params, Result, Resolver> {
  if (tags.length === 0) {
    throw new Error("Error: at least a single tag required.");
  }

  const resolver = ((...args: Params) => {
    let argIndex = 0;
    let path = "";
    const results: string[] = [];

    for (const tag of tags) {
      const tagResult =
        tag.resolved && "result" in tag
          ? tag.result
          : !tag.resolved && "resolver" in tag
          ? tag.resolver(
              ...(args[argIndex++] as Parameters<typeof tag.resolver>)
            ).result
          : (() => {
              throw new Error(`Invalid tag at index ${results.length}`);
            })();

      path = path ? `${path}/${tagResult}` : tagResult;
      results.push(path);
    }

    return {
      type: "hierarchy" as const,
      resolved: true as const,
      result: results as Result,
    };
  }) as Resolver;

  return {
    type: "hierarchy",
    resolved: false,
    resolver,
  };
}
