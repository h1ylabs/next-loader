/* eslint-disable @typescript-eslint/no-explicit-any */
import { Join } from "./type-utils/join";

// Common Tag Types
type UnresolvedTag = {
  readonly resolved: false;
};

type ResolvedTag<T extends string = string> = {
  readonly resolved: true;
  readonly result: T;
};

type ResolvedMultipleTag<T extends string[] = string[]> = {
  readonly resolved: true;
  readonly result: T;
};

type TagType = "single" | "composite" | "hierarchy";
type Tag<Type extends TagType> = { type: Type };

// Single Tag
export type SingleTag<
  Params extends SingleTagParameters = SingleTagParameters,
  Result extends SingleTagResult = SingleTagResult,
  Resolver extends SingleTagResolver<Params, Result> = SingleTagResolver<
    Params,
    Result
  >,
> = UnresolvedSingleTag<Params, Result, Resolver> | ResolvedSingleTag<Result>;

export type ResolvedSingleTag<Result extends SingleTagResult> = Tag<"single"> &
  ResolvedTag<Result>;
export type UnresolvedSingleTag<
  Params extends SingleTagParameters = SingleTagParameters,
  Result extends SingleTagResult = SingleTagResult,
  Resolver extends SingleTagResolver<Params, Result> = SingleTagResolver<
    Params,
    Result
  >,
> = Tag<"single"> &
  UnresolvedTag & {
    resolver: Resolver;
  };

export type SingleTagParameters = any[];
export type SingleTagResult = string;
export type SingleTagResolver<
  Params extends SingleTagParameters = SingleTagParameters,
  Result extends SingleTagResult = SingleTagResult,
> = (...args: Params) => ResolvedSingleTag<Result>;

// Hierarchy Tag Types
export type HierarchyTag<
  Tags extends readonly SingleTag[] = readonly SingleTag[],
  Params extends HierarchyTagParameters<Tags> = HierarchyTagParameters<Tags>,
  Result extends HierarchyTagResult<Tags> = HierarchyTagResult<Tags>,
  Resolver extends HierarchyTagResolver<
    Tags,
    Params,
    Result
  > = HierarchyTagResolver<Tags, Params, Result>,
> =
  | UnresolvedHierarchyTag<Tags, Params, Result, Resolver>
  | ResolvedHierarchyTag<Result>;

export type ResolvedHierarchyTag<Result extends string[]> = Tag<"hierarchy"> &
  ResolvedMultipleTag<Result>;

export type UnresolvedHierarchyTag<
  Tags extends readonly SingleTag[],
  Params extends HierarchyTagParameters<Tags>,
  Result extends HierarchyTagResult<Tags>,
  Resolver extends HierarchyTagResolver<Tags, Params, Result>,
> = Tag<"hierarchy"> &
  UnresolvedTag & {
    resolver: Resolver;
  };

export type HierarchyTagParameters<T extends readonly SingleTag[]> = T extends [
  infer U,
  ...infer V,
]
  ? V extends readonly SingleTag[]
    ? U extends SingleTag
      ? U extends ResolvedTag
        ? CompositeTagParameters<V>
        : U extends UnresolvedTag
          ? [Parameters<U["resolver"]>, ...CompositeTagParameters<V>]
          : never
      : never
    : U extends SingleTag
      ? U extends UnresolvedTag
        ? Parameters<U["resolver"]>
        : never
      : never
  : [];

export type HierarchyTagResult<
  T extends readonly SingleTag[],
  Prefix extends string = "",
> = T extends [infer U, ...infer V]
  ? V extends readonly SingleTag[]
    ? U extends SingleTag
      ? U extends ResolvedTag
        ? [
            Join<Prefix, U["result"], "/">,
            ...HierarchyTagResult<V, Join<Prefix, U["result"], "/">>,
          ]
        : U extends UnresolvedTag
          ? [
              Join<Prefix, ReturnType<U["resolver"]>["result"], "/">,
              ...HierarchyTagResult<
                V,
                Join<Prefix, ReturnType<U["resolver"]>["result"], "/">
              >,
            ]
          : never
      : never
    : U extends SingleTag
      ? U extends ResolvedTag
        ? [Join<Prefix, U["result"], "/">]
        : U extends UnresolvedTag
          ? [Join<Prefix, ReturnType<U["resolver"]>["result"], "/">]
          : never
      : never
  : [];

export type HierarchyTagResolver<
  Tags extends readonly SingleTag[],
  Params extends HierarchyTagParameters<Tags>,
  Result extends HierarchyTagResult<Tags>,
> = (...args: Params) => ResolvedHierarchyTag<Result>;

// Composite Tag Types
export type CompositeTag<
  Tags extends readonly SingleTag[] = readonly SingleTag[],
  Params extends CompositeTagParameters<Tags> = CompositeTagParameters<Tags>,
  Result extends CompositeTagResult<Tags> = CompositeTagResult<Tags>,
  Resolver extends CompositeTagResolver<
    Tags,
    Params,
    Result
  > = CompositeTagResolver<Tags, Params, Result>,
> =
  | UnresolvedCompositeTag<Tags, Params, Result, Resolver>
  | ResolvedCompositeTag<Result>;

export type ResolvedCompositeTag<Result extends string> = Tag<"composite"> &
  ResolvedTag<Result>;
export type UnresolvedCompositeTag<
  Tags extends readonly SingleTag[],
  Params extends CompositeTagParameters<Tags>,
  Result extends CompositeTagResult<Tags>,
  Resolver extends CompositeTagResolver<Tags, Params, Result>,
> = Tag<"composite"> &
  UnresolvedTag & {
    resolver: Resolver;
  };

export type CompositeTagParameters<T extends readonly SingleTag[]> = T extends [
  infer U,
  ...infer V,
]
  ? V extends readonly SingleTag[]
    ? U extends SingleTag
      ? U extends ResolvedTag
        ? CompositeTagParameters<V>
        : U extends UnresolvedTag
          ? [Parameters<U["resolver"]>, ...CompositeTagParameters<V>]
          : never
      : never
    : U extends SingleTag
      ? U extends UnresolvedTag
        ? Parameters<U["resolver"]>
        : never
      : never
  : [];

export type CompositeTagResult<
  T extends readonly SingleTag[],
  Prefix extends string = "",
> = T extends [infer U, ...infer V]
  ? V extends readonly SingleTag[]
    ? U extends SingleTag
      ? U extends ResolvedTag
        ? CompositeTagResult<V, Join<Prefix, U["result"], "_">>
        : U extends UnresolvedTag
          ? CompositeTagResult<
              V,
              Join<Prefix, ReturnType<U["resolver"]>["result"], "_">
            >
          : never
      : never
    : U extends SingleTag
      ? U extends ResolvedTag
        ? Join<Prefix, U["result"], "_">
        : U extends UnresolvedTag
          ? Join<Prefix, ReturnType<U["resolver"]>["result"], "_">
          : never
      : never
  : Prefix;

export type CompositeTagResolver<
  Tags extends readonly SingleTag[],
  Params extends CompositeTagParameters<Tags>,
  Result extends CompositeTagResult<Tags>,
> = (...args: Params) => ResolvedCompositeTag<Result>;
