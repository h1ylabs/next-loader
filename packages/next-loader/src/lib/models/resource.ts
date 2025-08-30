/* eslint-disable @typescript-eslint/no-explicit-any */
import type { LoaderCoreOptions } from "@h1y/loader-core";

import { LoaderID } from "./loader";
import type { Dependencies, ResourceTag } from "./resourceTag";

export type Resource<
  Response,
  Tag extends ResourceTag = ResourceTag,
  Deps extends readonly string[] = readonly string[],
> = {
  tag: {
    // the tag information for the resource itself.
    resource: Tag;
    // the dependency tags for subordinate resources.
    dependencies: Deps;
  };
  options: { staleTime?: number };
  load: (
    loaderOptions: () => LoaderCoreOptions,
    retry: () => never,
    loaderID: LoaderID,
  ) => Promise<Response>;
};

export type ResourcesUsed = readonly Resource<any, any, any>[];
export type PrefetchedResources<Resources extends ResourcesUsed> =
  Resources extends readonly [infer P, ...infer Q]
    ? P extends Resource<infer Response, any, any>
      ? Q extends readonly Resource<any, any, any>[]
        ? readonly [Promise<Response>, ...PrefetchedResources<Q>]
        : never
      : never
    : [];

export type ResourceFactory<
  Request,
  Response,
  Tag extends ResourceTag,
  Deps extends readonly string[],
> = (req: Request) => Resource<Response, Tag, Deps>;

export type ResourceDeps<Resources extends ResourcesUsed> =
  Resources extends readonly [infer P, ...infer Q]
    ? P extends Resource<any, infer Tag, infer Deps>
      ? Q extends readonly Resource<any, any, any>[]
        ? readonly [...Dependencies<Tag>, ...Deps, ...ResourceDeps<Q>]
        : never
      : never
    : [];
