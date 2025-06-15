import {
  HierarchyTagParameters,
  HierarchyTagResolver,
  HierarchyTagResult,
  SingleTag,
  UnresolvedHierarchyTag,
} from "./types";

export function hierarchy<
  Tags extends readonly SingleTag[],
  Params extends HierarchyTagParameters<Tags>,
  Result extends HierarchyTagResult<Tags>,
  Resolver extends HierarchyTagResolver<Tags, Params, Result>,
>(...tags: Tags): UnresolvedHierarchyTag<Tags, Params, Result, Resolver> {
  if (tags.length === 0) {
    throw new Error("Error: at least a single tag required.");
  }

  function resolve(...params: Params) {
    let nonEmptyParamIdx = 0;
    let currentTag = "";

    const result = tags.map((tag) => {
      const resolvedTag = tag.resolved
        ? tag.result
        : tag.resolver(...params[nonEmptyParamIdx++]!).result;
      const resolvedHierarchyTag = (currentTag = currentTag
        ? `${currentTag}/${resolvedTag}`
        : resolvedTag);

      return resolvedHierarchyTag;
    });

    return {
      type: "hierarchy",
      resolved: true,
      result,
    };
  }

  return {
    type: "hierarchy",
    resolved: false,
    resolver: resolve as Resolver,
  };
}
