type Single = string;
type Hierarchy = readonly string[];

export type ResourceTag = {
  // used to identify the uniqueness of a specific resource.
  readonly id: Single | Hierarchy;
  readonly effects?: readonly Single[];
};

export function validateTag<const T extends ResourceTag>(tag: T) {
  if (isHierarchyTag(tag.id) && tag.id.length === 0) {
    throw new Error(MSG_ERR_INVALID_HIERARCHY_TAG);
  }

  return tag;
}

// represents the tag responsible for the identity of a specific resource.
export function idTag(tag: ResourceTag) {
  if (isHierarchyTag(tag.id)) {
    if (tag.id.length === 0) {
      throw new Error(MSG_ERR_INVALID_HIERARCHY_TAG);
    }

    return tag.id[tag.id.length - 1]!;
  }

  return tag.id;
}

// used when revalidating a specific resource.
export function resourceRevalidationTags<const Tag extends ResourceTag>(
  tag: Tag,
): Revalidation<Tag> {
  return (isHierarchyTag(tag.id) ? tag.id : [tag.id]) as Revalidation<Tag>;
}

// used when specifying revalidation tags.
export function dependencyRevalidationTags<const Tag extends ResourceTag>(
  tag: Tag,
): Dependencies<Tag> {
  return [idTag(tag), ...(tag.effects ?? [])] as Dependencies<Tag>;
}

export type Revalidation<Tag extends ResourceTag> = Tag["id"] extends Single
  ? readonly [Tag["id"]]
  : Tag["id"] extends Hierarchy
    ? Tag["id"]
    : readonly string[];

export type Dependencies<Tag extends ResourceTag> =
  Tag["effects"] extends readonly string[]
    ? Tag["id"] extends Single
      ? readonly [Tag["id"], ...Tag["effects"]]
      : Tag["id"] extends Hierarchy
        ? readonly [Last<Tag["id"]>, ...Tag["effects"]]
        : never
    : Tag["id"] extends Single
      ? readonly [Tag["id"]]
      : Tag["id"] extends Hierarchy
        ? readonly [Last<Tag["id"]>]
        : never;

export const MSG_ERR_INVALID_HIERARCHY_TAG =
  "invalid hierarchy tag: must have at least one tag";

type Last<T extends readonly unknown[]> = [unknown, ...T][T["length"]];

function isHierarchyTag(id: Single | Hierarchy): id is Hierarchy {
  return Array.isArray(id);
}
