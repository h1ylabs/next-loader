import { ERR_TAG_INVALID_INPUT } from "./errors";
import {
  ResolvedSingleTag,
  SingleTag,
  SingleTagParameters,
  SingleTagResolver,
  SingleTagResult,
  UnresolvedSingleTag,
} from "./types";

/**
 * Creates a single tag, which can either be a pre-resolved string value or a function that resolves
 * to a string based on provided arguments. This function is overloaded to support both direct values
 * and dynamic resolvers.
 *
 * @param {Resolver} resolver - A function that takes specific arguments (matching `Params`) and returns an object
 *   with a `result` property, which is the final string value for the tag. Use this when the tag's value
 *   needs to be dynamically generated at a later stage.
 * @returns {UnresolvedSingleTag<Params, Result, Resolver>} An unresolved single tag object. Its value will be
 *   determined by calling the provided resolver function with appropriate arguments later.
 */
export function tag<
  Params extends SingleTagParameters,
  Result extends SingleTagResult,
  Resolver extends SingleTagResolver<Params, Result>,
>(resolver: Resolver): UnresolvedSingleTag<Params, Result, Resolver>;

/**
 * Creates a single tag with a directly provided string value, making it immediately resolved.
 *
 * @param {Result} tag - The direct string value for the tag. This value will be used as-is,
 *   without any further processing or resolution.
 * @returns {ResolvedSingleTag<Result>} A resolved single tag object, containing the provided string value.
 */
export function tag<Result extends SingleTagResult>(
  tag: Result,
): ResolvedSingleTag<Result>;

/**
 * Overload implementation for the `tag` function. It handles both direct string values and resolver functions
 * to create a `SingleTag`.
 *
 * @param {Resolver | Result} value - Either a direct string value for an immediately resolved tag, or a function
 *   that will resolve to a string value when called with appropriate parameters.
 * @returns {SingleTag<Params, Result, Resolver>} A `SingleTag` object, which is either resolved with a direct result
 *   or remains unresolved, containing a resolver function.
 */
export function tag<
  Params extends SingleTagParameters,
  Result extends SingleTagResult,
  Resolver extends SingleTagResolver<Params, Result>,
>(value: Resolver | Result): SingleTag<Params, Result, Resolver> {
  if (isSingleTagResult(value)) {
    return {
      type: "single",
      resolved: true,
      result: value,
    };
  }

  if (isSingleTagResolver(value)) {
    return {
      type: "single",
      resolved: false,
      resolver: value,
    };
  }

  throw new Error(ERR_TAG_INVALID_INPUT);
}

function isSingleTagResult(value: unknown): value is SingleTagResult {
  return typeof value === "string";
}

function isSingleTagResolver(value: unknown): value is SingleTagResolver {
  return typeof value === "function";
}
