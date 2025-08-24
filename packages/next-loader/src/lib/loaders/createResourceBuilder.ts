import { LoaderCoreOptions } from "@h1y/loader-core";
import { nanoid } from "nanoid";

import {
  __RESOURCE_ID,
  type PrefetchedResources,
  type ResourceDeps,
  type ResourceFactory,
  type ResourcesUsed,
} from "../models/resource";
import type { ResourceOptions } from "../models/resourceAdapter";
import {
  dependencyRevalidationTags,
  type ResourceTag,
  validateTag,
} from "../models/resourceTag";

/**
 * Creates a resource builder factory that defines how to fetch, cache, and manage data.
 * Supports dependency resolution, cache tagging, and hierarchical relationships between resources.
 *
 * @param props - Configuration object for the resource
 * @param props.tags - Function that generates cache tags based on the request
 * @param props.options - Resource options including staleTime for cache invalidation
 * @param props.use - Array of dependent resources that this resource requires
 * @param props.load - Function that defines how to fetch and process the data
 * @returns A resource factory function that can be called with request parameters
 *
 * @example
 * ```typescript
 * // Simple resource without dependencies
 * const User = createResourceBuilder({
 *   tags: (req: { id: string }) => ({ identifier: `user-${req.id}` }),
 *   options: { staleTime: 300000 }, // 5 minutes
 *   use: [], // no dependencies
 *   load: async ({ req, fetch }) => {
 *     const response = await fetch(`/api/users/${req.id}`);
 *     return response.json();
 *   }
 * });
 *
 * // Resource with dependencies and hierarchical tags
 * const UserPosts = createResourceBuilder({
 *   tags: (req: { userId: string }) => ({
 *     identifier: hierarchyTag('user', req.userId, 'posts'), // hierarchical tag
 *     effects: ['user-activity'] // side effect tag
 *   }),
 *   options: { staleTime: 60000 }, // 1 minute
 *   use: [User({ id: req.userId })], // depends on User resource
 *   load: async ({ req, use, fetch, retry }) => {
 *     const [userData] = await Promise.all(use);
 *
 *     if (!userData.isActive) {
 *       retry(); // Retry if user is not active
 *     }
 *
 *     const response = await fetch(`/api/users/${req.userId}/posts`);
 *     return response.json();
 *   }
 * });
 *
 * // Usage in server component
 * const userResource = User({ id: '123' });
 * const postsResource = UserPosts({ userId: '123' });
 * ```
 */
export function createResourceBuilder<
  const Request,
  const Response,
  Tag extends ResourceTag,
  Resources extends ResourcesUsed,
>(props: {
  // cache tags that represent this resource.
  tags: (req: Request) => Tag;

  // extra resource options.
  options: { staleTime?: number };

  // resources that will be used.
  use: Resources;

  // load function that fetches and refines the data.
  load: <LoaderParam>(props: {
    // resources that have been prefetched.
    readonly use: PrefetchedResources<Resources>;

    // fetcher function that defaults to Next.js fetch() function.
    readonly fetch: (param: LoaderParam) => Promise<Response>;

    // request parameter.
    readonly req: Request;

    // access to loader options.
    readonly loaderOptions: () => LoaderCoreOptions<Response>;

    // retry loading this resource.
    readonly retry: () => never;
  }) => Promise<Response>;
}): ResourceFactory<Request, Response, Tag, ResourceDeps<Resources>> {
  return (req) => {
    // generate tags based on the request.
    const resourceTag = validateTag(props.tags(req));
    // unique ID required internally to identify the resource.
    const resourceID = nanoid();

    // revalidation tags for dependent resources.
    const dependencyTags = props.use
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
      props.options.staleTime,
      ...props.use.map((res) => res.options.staleTime),
    ].filter((staleTime) => staleTime !== undefined);

    const options: ResourceOptions = {
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

      load: async (adapter, loaderOptions, retry) => {
        return props.load({
          // request parameter.
          req,

          // resources used as dependencies.
          use: props.use.map(({ load }) =>
            load(adapter, loaderOptions, retry),
          ) as PrefetchedResources<Resources>,

          // fetcher function.
          fetch: adapter({
            tags: revalidationTags,
            options: props.options,
          }),

          loaderOptions,
          retry,
        });
      },

      [__RESOURCE_ID]: resourceID,
    };
  };
}

export const MSG_ERR_CIRCULAR_DEPENDENCY = (circularDependency: string) =>
  `circular dependency detected: ${circularDependency}`;
