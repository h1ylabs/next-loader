import React from "react";

import { Resource, ResourceBuilder } from "./types/resource";
import { ResourceOptions } from "./types/resource-options";
import createHash from "./utils/create-hash";

function resolveTags<Options extends ResourceOptions>(
  { tags, parents }: Options,
  convertor: (target: string) => Promise<string>,
): {
  tags: Resource<unknown, Options>["tags"];
  signatures: Resource<unknown, Options>["__signatures"];
} {
  // 상위 의존성
  const parentResources = parents ?? [];

  const currentTags = Array.isArray(tags) ? [...tags] : [tags];
  const tagsFromParents = parentResources.map((val) => val.tags.current).flat();

  const signatures = {
    ...Object.fromEntries(currentTags.map((tag) => [tag, convertor(tag)])),
    ...Object.fromEntries(
      parentResources.flatMap(({ tags, __signatures }) =>
        tags.current.map((tag) => [tag, __signatures[tag]!]),
      ),
    ),
  };

  return {
    tags: {
      current: currentTags,
      parents: tagsFromParents,
    },
    signatures,
  };
}

/**
 * loader에 사용될 Resource를 만듭니다.
 */
export default function buildResource<
  RequestOption,
  Result,
  Options extends ResourceOptions,
>(
  optionResolver: (request: RequestOption) => Options,
  builder: ResourceBuilder<Result, Options>,
): (request: RequestOption) => Resource<Result, Options> {
  return function (request: RequestOption) {
    const options = optionResolver(request);
    const builderInfo = builder(options);
    const { tags, signatures } = resolveTags(options, createHash);

    const load: Resource<Result, Options>["load"] = async (fetcher) => {
      return builderInfo.load(
        async (...[input, init]: Parameters<typeof fetcher>) =>
          fetcher(input, {
            ...init,
            next: {
              ...init?.next,

              // fetch 시 특정 리소스에 대한 태그를 부여합니다.
              tags: await Promise.all(Object.values(signatures)),
              revalidate: options.revalidate,
            },
          }),
      );
    };

    return {
      load: options.disableRequestMemo ? load : React.cache(load),

      tags,
      __options: options,
      __signatures: signatures,
    };
  };
}
