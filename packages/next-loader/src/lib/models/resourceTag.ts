type Single = string;
type Hierarchy = readonly string[];

export type ResourceTag = {
  // 특정 리소스의 고유성을 식별하기 위한 수단입니다.
  // "리소스"를 재검증할 경우, 이걸 그대로 재검증 대상에 포함시키면 됩니다.
  // 재검증 대상을 구성할 때는, 가장 마지막 원소를 지정하면 됩니다.
  // 중복이 존재할 경우 에러가 발생합니다.
  readonly identifier: Single | Hierarchy;

  // 이펙트 태그를 나타냅니다.
  // 다른 곳에 영향을 받을 수 있도록 합니다.
  readonly effects?: readonly Single[];
};

export function validateTag<const T extends ResourceTag>(tag: T) {
  if (isHierarchyTag(tag.identifier) && tag.identifier.length === 0) {
    throw new Error(MSG_ERR_INVALID_HIERARCHY_TAG);
  }

  return tag;
}

// 특정 리소스의 정체성을 담당하는 태그를 나타냅니다.
export function identifierTag(tag: ResourceTag) {
  if (isHierarchyTag(tag.identifier)) {
    if (tag.identifier.length === 0) {
      throw new Error(MSG_ERR_INVALID_HIERARCHY_TAG);
    }

    return tag.identifier[tag.identifier.length - 1]!;
  }

  return tag.identifier;
}

// 특정 리소스를 재검증할 때 사용합니다.
export function resourceRevalidationTags<const Tag extends ResourceTag>(
  tag: Tag,
): Revalidation<Tag> {
  return (
    isHierarchyTag(tag.identifier) ? tag.identifier : [tag.identifier]
  ) as Revalidation<Tag>;
}

// 재검증 태그를 지정할 때 사용합니다.
export function dependencyRevalidationTags<const Tag extends ResourceTag>(
  tag: Tag,
): Dependencies<Tag> {
  return [identifierTag(tag), ...(tag.effects ?? [])] as Dependencies<Tag>;
}

export type Revalidation<Tag extends ResourceTag> =
  Tag["identifier"] extends Single
    ? readonly [Tag["identifier"]]
    : Tag["identifier"] extends Hierarchy
      ? Tag["identifier"]
      : never;

export type Dependencies<Tag extends ResourceTag> =
  Tag["effects"] extends readonly string[]
    ? Tag["identifier"] extends Single
      ? readonly [Tag["identifier"], ...Tag["effects"]]
      : Tag["identifier"] extends Hierarchy
        ? readonly [Last<Tag["identifier"]>, ...Tag["effects"]]
        : never
    : readonly [Tag["identifier"]];

export const MSG_ERR_INVALID_HIERARCHY_TAG =
  "invalid hierarchy tag: must have at least one tag";

type Last<T extends readonly unknown[]> = [unknown, ...T][T["length"]];

function isHierarchyTag(
  identifier: Single | Hierarchy,
): identifier is Hierarchy {
  return Array.isArray(identifier);
}
