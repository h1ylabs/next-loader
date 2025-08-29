/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  loader as loaderCore,
  type LoaderCoreInput,
  type LoaderMiddleware,
} from "@h1y/loader-core";

import { DEFAULT_LOADER_PROPS, LoaderDependencies } from "../models/loader";
import type { Resource } from "../models/resource";
import {
  resourceRevalidationTags,
  type ResourceTag,
} from "../models/resourceTag";
import {
  type NormalizableOptions,
  normalizeOptions,
} from "../utils/normalizeOptions";

export function createBaseLoader<
  Middlewares extends readonly LoaderMiddleware<unknown, unknown, string>[],
>({
  props,
  middlewares,
  dependencies,
}: {
  readonly props?: LoaderProps;
  readonly middlewares?: Middlewares;
  readonly dependencies?: LoaderDependencies;
}) {
  const input = normalizeProps(props);
  const { retryImmediately, loaderOptions, execute } = loaderCore().withOptions(
    {
      input,
      middlewares: [...(middlewares ?? [])],
      propagateRetry: "HAS_OUTER_CONTEXT",
    },
  );

  const loadResource = async <Response = unknown>(
    resource: Resource<Response>,
  ) => {
    return execute(async () =>
      resource.load(
        loaderOptions,
        retryImmediately,
        loaderOptions().metadata.contextID,
        dependencies?.memo ?? ((fn) => fn),
      ),
    );
  };

  return function loader<const Resources extends LoaderResources>(
    ...resources: Resources
  ) {
    const revalidation = resources
      .map((resource) => resourceRevalidationTags(resource.tag.resource))
      .flat();

    const load = async (): Promise<ResourceResult<Resources>> => {
      return (await Promise.all(
        resources.map((res) => loadResource(res)),
      )) as ResourceResult<Resources>;
    };

    return [load, revalidation] as const;
  };
}

export type RequiredLoaderProps = LoaderCoreInput<unknown>;
export type LoaderProps = NormalizableOptions<RequiredLoaderProps>;

// not used!
export const MSG_ERR_IDENTIFIER_TAG_MISMATCH = (tag1: string, tag2: string) =>
  `identifier tag mismatch at same resource: ${tag1} and ${tag2}`;

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
