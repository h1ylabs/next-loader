/**
 * Creates hierarchical cache tags by joining tags with forward slashes.
 * This allows for granular cache invalidation where parent tags can invalidate child resources.
 *
 * @param tags - Array of string tags to create a hierarchy from
 * @returns Array of hierarchical tags where each tag includes all previous levels
 *
 * @example
 * ```typescript
 * // Creates hierarchical tags: ['user', 'user/posts', 'user/posts/comments']
 * const tags = hierarchyTag('user', 'posts', 'comments');
 *
 * // Usage in resource builder
 * const UserComments = createResourceBuilder({
 *   tags: (req) => ({ identifier: hierarchyTag('user', req.userId, 'comments') }),
 *   // ... rest of config
 * });
 * ```
 */
export function hierarchyTag<Tags extends readonly string[]>(
  ...tags: Tags
): HierarchyTag<Tags> {
  if (tags.length === 0) {
    throw new Error(MSG_ERR_HIERARCHY_EMPTY_TAG_ARRAY);
  }

  let currentTag = "";

  return tags.map((tag) => {
    return (currentTag = currentTag ? `${currentTag}/${tag}` : tag);
  }) as HierarchyTag<Tags>;
}

export type HierarchyTag<
  T extends readonly string[],
  Prefix extends string = "",
> = T extends [infer U, ...infer V]
  ? V extends readonly string[]
    ? U extends string
      ? [Join<Prefix, U, "/">, ...HierarchyTag<V, Join<Prefix, U, "/">>]
      : never
    : U extends string
      ? [Join<Prefix, U, "/">]
      : never
  : [];

export const MSG_ERR_HIERARCHY_EMPTY_TAG_ARRAY =
  "the tag array cannot be empty - at least one tag is required.";

type Join<
  Left extends string,
  Right extends string,
  Separator extends string,
> = Left extends ""
  ? Right
  : Right extends ""
    ? Left
    : `${Left}${Separator}${Right}`;
