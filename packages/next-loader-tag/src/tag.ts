import {
  ResolvedSingleTag,
  SingleTag,
  SingleTagParameters,
  SingleTagResolver,
  SingleTagResult,
  UnresolvedSingleTag,
} from "./types";

export function tag<
  Params extends SingleTagParameters,
  Result extends SingleTagResult,
  Resolver extends SingleTagResolver<Params, Result>,
>(resolver: Resolver): UnresolvedSingleTag<Params, Result, Resolver>;

export function tag<Result extends SingleTagResult>(
  tag: Result,
): ResolvedSingleTag<Result>;

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

  throw new Error(
    "Unexpected error: resolver is valid but doesn't match any known type.",
  );
}

function isSingleTagResult(value: unknown): value is SingleTagResult {
  return typeof value === "string";
}

function isSingleTagResolver(value: unknown): value is SingleTagResolver {
  return typeof value === "function";
}
