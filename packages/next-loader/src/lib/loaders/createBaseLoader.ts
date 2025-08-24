/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  loader as loaderCore,
  type LoaderCoreInput,
  LoaderCoreOptions,
  type LoaderMiddleware,
} from "@h1y/loader-core";

import { __RESOURCE_ID, type Resource } from "../models/resource";
import { ResourceAdapter } from "../models/resourceAdapter";
import { identifierTag, type ResourceTag } from "../models/resourceTag";
import {
  type NormalizableOptions,
  normalizeOptions,
} from "../utils/normalizeOptions";

export const DEFAULT_LOADER_PROPS = {
  retry: { maxCount: 0, canRetryOnError: false },
  timeout: { delay: 60000 },
} as const;

export function createBaseLoader<
  LoaderParam,
  Middlewares extends readonly LoaderMiddleware<unknown, unknown, string>[],
>({
  props,
  middlewares,
  dependencies,
}: {
  readonly props?: LoaderProps;
  readonly middlewares?: Middlewares;
  readonly dependencies?: LoaderDependencies<LoaderParam>;
}) {
  const input = normalizeProps(props);
  const { retry, loaderOptions, execute } = loaderCore().withOptions({
    input,
    middlewares: [...(middlewares ?? [])],
    propagateRetry: "HAS_OUTER_CONTEXT",
  });

  const loadResource = async <Response = unknown>(
    resource: Resource<Response>,
  ) => {
    if (!dependencies?.adapter) {
      throw new Error(MSG_ERR_ADAPTER_REQUIRED);
    }
    return execute(async () =>
      resource.load<LoaderParam>(
        dependencies.adapter as ResourceAdapter<LoaderParam, Response>,
        loaderOptions as () => LoaderCoreOptions<Response>,
        retry,
      ),
    );
  };

  // cache for loaders of specific resources (ID)
  const loaders = new Map<string, readonly [string, () => unknown]>();

  // cache for all resource IDs with specific identifier tags (for warning)
  const tags = new Map<string, Set<string>>();

  return {
    /**
     * Creates loader functions for the provided resources.
     *
     * @param resources - Resource instances to create loaders for
     * @returns A tuple containing [load, revalidate] functions
     *
     * @example
     * ```typescript
     * // Global resource builders (declared once)
     * const User = createResourceBuilder({...});
     * const Posts = createResourceBuilder({...});
     *
     * // In server component - use the pre-declared builders
     * async function UserProfilePage({ userId }: { userId: string }) {
     *   const { loader } = createBaseLoader(dependencies, options);
     *   const [load, revalidate] = loader(
     *     User({ id: userId }),           // Use global User builder
     *     Posts({ authorId: userId })     // Use global Posts builder
     *   );
     *
     *   const [userData, postsData] = await load();
     *
     *   return (
     *     <div>
     *       <h1>{userData.name}</h1>
     *       <form action={revalidate}>
     *         <button>Refresh</button>
     *       </form>
     *     </div>
     *   );
     * }
     * ```
     */
    loader: <const Resources extends LoaderResources>(
      ...resources: Resources
    ) => {
      const resourceLoaders = resources.map((resource) => {
        const id = resource[__RESOURCE_ID];
        const tag = identifierTag(resource.tag.resource);
        const fn = async () => loadResource(resource);

        // 1. if the loader function already exists, return it.
        if (loaders.has(id)) {
          const [memoTag, memoFn] = loaders.get(id)!;

          if (memoTag !== tag) {
            throw new Error(MSG_ERR_IDENTIFIER_TAG_MISMATCH(memoTag, tag));
          }

          return memoFn as typeof fn;
        }

        // 2. check if there is a resource with the same identifier tag but different ID
        let duplicatedTags = tags.get(tag);

        if (!duplicatedTags) {
          tags.set(tag, (duplicatedTags = new Set()));
        } else if (!duplicatedTags.has(id)) {
          // Found same identifier tag with different resource ID - this is a duplicate
          console.warn(MSG_WARN_IDENTIFIER_TAG_DUPLICATE(tag));
        }

        duplicatedTags.add(id);

        // cache the loader function with the memo function from external dependencies
        const memoFn = dependencies?.memo?.(fn) ?? fn;

        loaders.set(id, [tag, memoFn]);
        return memoFn;
      });

      /**
       * Loads all resources in parallel within the server component context.
       *
       * @returns Promise that resolves to array of resource results in the same order
       *
       * @example
       * ```typescript
       * async function UserProfilePage({ userId }: { userId: string }) {
       *   const [load, revalidate] = loader(
       *     User({ id: userId }),
       *     Posts({ authorId: userId })
       *   );
       *
       *   // Load data in server component
       *   const [userData, postsData] = await load();
       *
       *   return (
       *     <div>
       *       <h1>{userData.name}</h1>
       *       <PostsList posts={postsData} />
       *     </div>
       *   );
       * }
       * ```
       */
      const load = async (): Promise<ResourceResult<Resources>> => {
        return (await Promise.all(
          resourceLoaders.map((load) => load()),
        )) as ResourceResult<Resources>;
      };

      /**
       * Server action for cache revalidation in server component context.
       *
       * @important This is a server action with "use server" directive.
       *
       * @example
       * ```typescript
       * async function UserProfilePage({ userId }: { userId: string }) {
       *   const [load, revalidate] = loader(User({ id: userId }));
       *   const [userData] = await load();
       *
       *   return (
       *     <div>
       *       <h1>{userData.name}</h1>
       *       <form action={revalidate}>
       *         <button type="submit">Refresh Profile</button>
       *       </form>
       *     </div>
       *   );
       * }
       * ```
       */
      const revalidate = () => {
        "use server";

        if (dependencies?.revalidate) {
          dependencies.revalidate(
            ...resources
              .map((resource) => resource.tag.resource.identifier)
              .flat(),
          );
        }
      };

      return [load, revalidate] as const;
    },
  } as const;
}

export type RequiredLoaderProps = LoaderCoreInput<unknown>;
export type LoaderProps = NormalizableOptions<RequiredLoaderProps>;

export type LoaderDependencies<LoaderParam> = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  readonly memo?: <Fn extends Function>(fn: Fn) => Fn;
  readonly adapter?: ResourceAdapter<LoaderParam>;
  readonly revalidate?: (...tags: readonly string[]) => void;
};

export const MSG_ERR_IDENTIFIER_TAG_MISMATCH = (tag1: string, tag2: string) =>
  `identifier tag mismatch at same resource: ${tag1} and ${tag2}`;

export const MSG_ERR_ADAPTER_REQUIRED =
  "adapter is required in createBaseLoader dependencies";

export const MSG_WARN_IDENTIFIER_TAG_DUPLICATE = (tag: string) =>
  `identifier tag duplicate: ${tag}`;

function normalizeProps(
  props?: LoaderProps,
  defaultProps: RequiredLoaderProps = DEFAULT_LOADER_PROPS,
): RequiredLoaderProps {
  return normalizeOptions(defaultProps, props);
}

type LoaderResources = readonly Resource<any, ResourceTag, readonly string[]>[];
type ResourceResult<Resources extends LoaderResources> =
  Resources extends readonly [infer First, ...infer Last]
    ? First extends Resource<infer Response, any, any>
      ? Last extends LoaderResources
        ? [Response, ...ResourceResult<Last>]
        : never
      : never
    : [];
