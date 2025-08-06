import {
  HierarchyTagParameters,
  HierarchyTagResolver,
  HierarchyTagResult,
  SingleTag,
  UnresolvedHierarchyTag,
} from "./types";

/**
 * Creates a hierarchy tag by combining multiple individual tags into a path-like structure.
 * When resolved, the results of the individual tags are joined by a `/` to form a single hierarchical path.
 * This is particularly useful for constructing dynamic URLs or file paths where each segment
 * is derived from a separate tag.
 *
 * @param {Tags} tags - The individual `tag` instances you want to arrange hierarchically. You must provide at least one tag.
 * @returns {UnresolvedHierarchyTag<Tags, Params, Result, Resolver>} An unresolved hierarchy tag object. When its resolver
 *   function is called with the necessary arguments, it will produce the complete hierarchical path.
 * @throws {Error} If you call this function without providing any tags.
 */
export function hierarchy<
  Tags extends readonly SingleTag[],
  Params extends HierarchyTagParameters<Tags>,
  Result extends HierarchyTagResult<Tags>,
  Resolver extends HierarchyTagResolver<Tags, Params, Result>,
>(...tags: Tags): UnresolvedHierarchyTag<Tags, Params, Result, Resolver> {
  if (tags.length === 0) {
    throw new Error(MSG_ERR_HIERARCHY_EMPTY_TAG_ARRAY);
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

export const MSG_ERR_HIERARCHY_EMPTY_TAG_ARRAY =
  "The tag array cannot be empty. At least one tag is required.";
