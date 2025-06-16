import { ERR_EMPTY_TAG_ARRAY } from "./errors";
import {
  CompositeTagParameters,
  CompositeTagResolver,
  CompositeTagResult,
  SingleTag,
  UnresolvedCompositeTag,
} from "./types";

/**
 * Creates a composite tag by combining the resolved string values of multiple individual tags.
 * When resolved, the results of the individual tags are joined together with an underscore (`_`)
 * to form a single, concatenated string.
 *
 * @param {Tags} tags - The individual `tag` instances you want to compose. You must provide at least one tag.
 * @returns {UnresolvedCompositeTag<Tags, Params, Result, Resolver>} An unresolved composite tag object. When its resolver
 *   function is called with the necessary arguments, it will produce the complete composed string.
 * @throws {Error} If you call this function without providing any tags.
 */
export function compose<
  Tags extends readonly SingleTag[],
  Params extends CompositeTagParameters<Tags>,
  Result extends CompositeTagResult<Tags>,
  Resolver extends CompositeTagResolver<Tags, Params, Result>,
>(...tags: Tags): UnresolvedCompositeTag<Tags, Params, Result, Resolver> {
  if (tags.length === 0) {
    throw new Error(ERR_EMPTY_TAG_ARRAY);
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
