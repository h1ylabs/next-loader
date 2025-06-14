/* eslint-disable @typescript-eslint/no-explicit-any */

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

type Merge<
  T extends string,
  U extends string,
  Connection extends string
> = T extends "" ? U : `${T}${Connection}${U}`;

// Single Tag
export type SingleTag<
  Params extends SingleTagParameters = SingleTagParameters,
  Result extends SingleTagResult = SingleTagResult,
  Resolver extends SingleTypeResolver<Params, Result> = SingleTypeResolver<
    Params,
    Result
  >
> = UnresolvedSingleTag<Params, Result, Resolver> | ResolvedSingleTag<Result>;

export type ResolvedSingleTag<Result extends string> = Tag<"single"> &
  ResolvedTag<Result>;
export type UnresolvedSingleTag<
  Params extends SingleTagParameters = SingleTagParameters,
  Result extends SingleTagResult = SingleTagResult,
  Resolver extends SingleTypeResolver<Params, Result> = SingleTypeResolver<
    Params,
    Result
  >
> = Tag<"single"> &
  UnresolvedTag & {
    resolver: Resolver;
  };

export type SingleTagParameters = any[];
export type SingleTagResult = string;
export type SingleTypeResolver<
  Params extends SingleTagParameters = SingleTagParameters,
  Result extends SingleTagResult = SingleTagResult
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
  > = HierarchyTagResolver<Tags, Params, Result>
> =
  | UnresolvedHierarchyTag<Tags, Params, Result, Resolver>
  | ResolvedHierarchyTag<Result>;

export type ResolvedHierarchyTag<Result extends string[]> = Tag<"hierarchy"> &
  ResolvedMultipleTag<Result>;

export type UnresolvedHierarchyTag<
  Tags extends readonly SingleTag[],
  Params extends HierarchyTagParameters<Tags>,
  Result extends HierarchyTagResult<Tags>,
  Resolver extends HierarchyTagResolver<Tags, Params, Result>
> = Tag<"hierarchy"> &
  UnresolvedTag & {
    resolver: Resolver;
  };

export type HierarchyTagParameters<T extends readonly SingleTag[]> = T extends [
  infer U,
  ...infer V
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
  Prefix extends string = ""
> = T extends [infer U, ...infer V]
  ? V extends readonly SingleTag[]
    ? U extends SingleTag
      ? U extends ResolvedTag
        ? [
            Merge<Prefix, U["result"], "/">,
            ...HierarchyTagResult<V, Merge<Prefix, U["result"], "/">>
          ]
        : U extends UnresolvedTag
        ? [
            Merge<Prefix, ReturnType<U["resolver"]>["result"], "/">,
            ...HierarchyTagResult<
              V,
              Merge<Prefix, ReturnType<U["resolver"]>["result"], "/">
            >
          ]
        : never
      : never
    : U extends SingleTag
    ? U extends ResolvedTag
      ? [Merge<Prefix, U["result"], "/">]
      : U extends UnresolvedTag
      ? [Merge<Prefix, ReturnType<U["resolver"]>["result"], "/">]
      : never
    : never
  : [];

export type HierarchyTagResolver<
  Tags extends readonly SingleTag[],
  Params extends HierarchyTagParameters<Tags>,
  Result extends HierarchyTagResult<Tags>
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
  > = CompositeTagResolver<Tags, Params, Result>
> =
  | UnresolvedCompositeTag<Tags, Params, Result, Resolver>
  | ResolvedCompositeTag<Result>;

export type ResolvedCompositeTag<Result extends string> = Tag<"composite"> &
  ResolvedTag<Result>;
export type UnresolvedCompositeTag<
  Tags extends readonly SingleTag[],
  Params extends CompositeTagParameters<Tags>,
  Result extends CompositeTagResult<Tags>,
  Resolver extends CompositeTagResolver<Tags, Params, Result>
> = Tag<"composite"> &
  UnresolvedTag & {
    resolver: Resolver;
  };

export type CompositeTagParameters<T extends readonly SingleTag[]> = T extends [
  infer U,
  ...infer V
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
  Prefix extends string = ""
> = T extends [infer U, ...infer V]
  ? V extends readonly SingleTag[]
    ? U extends SingleTag
      ? U extends ResolvedTag
        ? CompositeTagResult<V, Merge<Prefix, U["result"], "_">>
        : U extends UnresolvedTag
        ? CompositeTagResult<
            V,
            Merge<Prefix, ReturnType<U["resolver"]>["result"], "_">
          >
        : never
      : never
    : U extends SingleTag
    ? U extends ResolvedTag
      ? Merge<Prefix, U["result"], "_">
      : U extends UnresolvedTag
      ? Merge<Prefix, ReturnType<U["resolver"]>["result"], "_">
      : never
    : never
  : Prefix;

export type CompositeTagResolver<
  Tags extends readonly SingleTag[],
  Params extends CompositeTagParameters<Tags>,
  Result extends CompositeTagResult<Tags>
> = (...args: Params) => ResolvedCompositeTag<Result>;
