import React from "react";

import { Resource, ResourceBuilder } from "./types/resource";
import { ResourceOptions } from "./types/resource-options";
import createHash from "./utils/create-hash";

async function resolveTags<Options extends ResourceOptions>(
  { tags, parents }: Options,
  convertor: (target: string) => Promise<string>,
): Promise<{
  tags: Resource<unknown, Options>["tags"];
  hash: Resource<unknown, Options>["__tagHash"];
}> {
  // 상위 의존성
  const parentResources = parents ?? [];

  const currentTags = Array.isArray(tags) ? [...tags] : [tags];
  const tagsFromParents = parentResources.map((val) => val.tags.current).flat();

  const hash = {
    ...Object.fromEntries(
      await Promise.all(
        currentTags.map((tag) => (async () => [tag, await convertor(tag)])()),
      ),
    ),
    ...Object.fromEntries(
      parentResources.flatMap(({ tags, __tagHash }) =>
        tags.current.map((tag) => [tag, __tagHash[tag]!]),
      ),
    ),
  };

  return {
    tags: {
      current: currentTags,
      parents: tagsFromParents,
    },
    hash,
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
): (request: RequestOption) => Promise<Resource<Result, Options>> {
  return async function (request: RequestOption) {
    const options = optionResolver(request);
    const builderInfo = builder(options);
    const { tags, hash } = await resolveTags(options, createHash);

    const load: Resource<Result, Options>["load"] = async (fetcher) => {
      // fetch 시 특정 리소스에 대한 태그를 부여합니다.
      const hashedTags = Object.values(hash);

      return builderInfo.load(
        async (...[input, init]: Parameters<typeof fetcher>) =>
          fetcher(input, {
            ...init,
            next: {
              ...init?.next,
              tags: hashedTags,
              revalidate: options.revalidate,
            },
          }),
      );
    };

    return {
      load: options.disableRequestMemo ? load : React.cache(load),

      tags,
      __options: options,
      __tagHash: hash,
    };
  };
}
