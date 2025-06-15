import {
  ResolvedSingleTag,
  SingleTag,
  SingleTagParameters,
  SingleTagResult,
  SingleTypeResolver,
  UnresolvedSingleTag,
} from "./types";

export function tag<
  Params extends SingleTagParameters,
  Result extends SingleTagResult,
  Resolver extends SingleTypeResolver<Params, Result>,
>(resolver: Resolver): UnresolvedSingleTag<Params, Result, Resolver>;

export function tag<Result extends SingleTagResult>(
  tag: Result,
): ResolvedSingleTag<Result>;

export function tag<
  Params extends SingleTagParameters,
  Result extends SingleTagResult,
  Resolver extends SingleTypeResolver<Params, Result>,
>(value: Resolver | Result): SingleTag<Params, Result, Resolver> {
  if (typeof value === "string") {
    return {
      type: "single",
      resolved: true,
      result: value,
    };
  }

  if (typeof value === "function") {
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
