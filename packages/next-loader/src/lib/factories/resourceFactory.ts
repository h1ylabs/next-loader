import { LoaderCoreOptions } from "@h1y/loader-core";

import { LoaderID } from "../models/loader";
import {
  type PrefetchedResources,
  type ResourceDeps,
  type ResourceFactory,
  type ResourcesUsed,
} from "../models/resource";
import type {
  ExternalResourceAdapter,
  ExternalResourceOptions,
} from "../models/resourceAdapter";
import {
  dependencyRevalidationTags,
  idTag,
  type ResourceTag,
  validateTag,
} from "../models/resourceTag";

export function resourceFactory<
  const Request,
  const Response,
  const Tag extends ResourceTag,
  const Resources extends ResourcesUsed,
>(props: {
  // cache tags that represent this resource.
  tags: (req: Request) => Tag;

  // extra resource options.
  options?: { staleTime?: number };

  // resources that will be used.
  use?: (req: Request) => Resources;

  // load function that fetches and refines the data.
  load: (props: {
    // resources that have been prefetched.
    readonly use: PrefetchedResources<Resources>;

    // fetcher function.
    readonly fetcher: <const ExternalResourceParam, const ExternalResource>(
      adapter: ExternalResourceAdapter<ExternalResourceParam, ExternalResource>,
    ) => { load: (param: ExternalResourceParam) => Promise<ExternalResource> };

    // request parameter.
    readonly req: Request;

    // access to loader options.
    readonly loaderOptions: () => LoaderCoreOptions;

    // retry loading this resource.
    readonly retry: () => never;
  }) => Promise<Response>;
}): ResourceFactory<Request, Response, ResourceTag, ResourceDeps<Resources>> {
  // cache
  const loaderResourceCache = new WeakMap<
    LoaderID,
    Map<string, Promise<unknown>>
  >();

  return (req) => {
    // generate tags based on the request.
    const resourceTag = validateTag(props.tags(req));

    // dependency resources
    const resources = props.use?.(req) ?? [];

    // revalidation tags for dependent resources.
    const dependencyTags = resources
      .map(({ tag }) => [
        ...dependencyRevalidationTags(tag.resource),
        ...tag.dependencies,
      ])
      .flat() as ResourceDeps<Resources>;

    // build revalidation tags for this resource.
    const revalidationTags = [
      ...dependencyRevalidationTags(resourceTag),
      ...dependencyTags,
    ] as string[];

    // use the minimum staleTime from all related resources.
    const staleTimeOption = [
      props.options?.staleTime,
      ...resources.map((res) => res.options.staleTime),
    ].filter((staleTime) => staleTime !== undefined);

    const options: ExternalResourceOptions = {
      ...props.options,
      staleTime:
        staleTimeOption.length > 0 ? Math.min(...staleTimeOption) : undefined,
    };

    return {
      options,
      tag: {
        resource: resourceTag,
        dependencies: dependencyTags,
      },

      load: async (loaderOptions, retry, loaderID): Promise<Response> => {
        let resourceContext = loaderResourceCache.get(loaderID);

        if (!resourceContext) {
          loaderResourceCache.set(loaderID, (resourceContext = new Map()));
        }

        const resourceID = idTag(resourceTag);
        let cachePromise = resourceContext.get(resourceID) as ReturnType<
          typeof props.load
        >;

        if (!resourceContext.has(resourceID)) {
          cachePromise = props.load({
            // request parameter.
            req,

            use: resources.map(({ load }) =>
              load(loaderOptions, retry, loaderID),
            ) as PrefetchedResources<Resources>,

            // fetcher function.
            fetcher: (adapter) => {
              const { load, validate } = adapter({
                tags: revalidationTags,
                options: props.options ?? {},
              });

              return {
                load: async (param) => {
                  validate?.(param);
                  return load(param);
                },
              };
            },

            loaderOptions,
            retry,
          });
          resourceContext.set(resourceID, cachePromise);
        }

        return cachePromise;
      },
    };
  };
}
