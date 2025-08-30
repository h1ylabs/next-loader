/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { resourceFactory } from "@/lib/factories/resourceFactory";
import type { LoaderID } from "@/lib/models/loader";
import type { Resource, ResourceFactory } from "@/lib/models/resource";
import type { ResourceTag } from "@/lib/models/resourceTag";

import { createMockAdapter } from "./mockResourceBuilder";

export interface TestResourceRequest {
  id: string;
  type?: string;
}

export interface TestResourceResponse {
  id: string;
  data: string;
  timestamp: number;
  loaderConfig?: {
    retry: { maxCount: number };
    timeout: { delay: number };
  } | null;
}

export const createTestResourceBuilder = (options?: {
  staleTime?: number;
  effects?: string[];
  dependencies?: Resource<unknown>[];
}): ResourceFactory<
  TestResourceRequest,
  TestResourceResponse,
  ResourceTag,
  readonly string[]
> => {
  return resourceFactory({
    tags: (req) => ({
      id: `test-resource-${req.id}`,
      effects: options?.effects,
    }),
    options: options?.staleTime ? { staleTime: options.staleTime } : undefined,
    use: options?.dependencies ? () => options.dependencies! : undefined,
    load: async ({ req, fetcher, loaderOptions }) => {
      const { load } = fetcher(createMockAdapter());
      const response = await load({
        url: `/api/test/${req.id}`,
        data: { id: req.id, type: req.type || "default" },
      } as any);
      return {
        id: req.id,
        data: `processed-${req.id}`,
        timestamp: response.timestamp,
        // Include loader configuration info for testing
        loaderConfig:
          typeof loaderOptions === "function"
            ? {
                retry: { maxCount: loaderOptions().retry.maxCount },
                timeout: { delay: loaderOptions().timeout.delay },
              }
            : null,
      };
    },
  });
};

export const createHierarchicalResourceBuilder = () => {
  return resourceFactory({
    tags: (req: { path: string[] }) => ({
      id: req.path,
      effects: [`${req.path.join("-")}-cache`],
    }),
    options: { staleTime: 2000 },
    use: undefined,
    load: async ({ req, fetcher, loaderOptions }) => {
      const { load } = fetcher(createMockAdapter());
      return load({
        url: `/api/${req.path.join("/")}`,
        data: { path: req.path },
        // Include loader configuration info for testing
        loaderConfig:
          typeof loaderOptions === "function"
            ? {
                retry: { maxCount: loaderOptions().retry.maxCount },
                timeout: { delay: loaderOptions().timeout.delay },
              }
            : null,
      } as any);
    },
  });
};

export const createDependentResourceBuilder = (
  parentResources: Resource<any, any, any>[],
  options?: { staleTime?: number },
) => {
  return resourceFactory({
    tags: (req: { id: string }) => ({
      id: `dependent-${req.id}`,
      effects: ["dependent-cache"],
    }),
    options: options?.staleTime ? { staleTime: options.staleTime } : undefined,
    use: () => parentResources,
    load: async ({ req, use, fetcher, loaderOptions }) => {
      const parents = await Promise.all(use);
      const { load } = fetcher(createMockAdapter());
      return load({
        url: `/api/dependent/${req.id}`,
        data: { id: req.id, parents },
        // Include loader configuration info for testing
        loaderConfig:
          typeof loaderOptions === "function"
            ? {
                retry: { maxCount: loaderOptions().retry.maxCount },
                timeout: { delay: loaderOptions().timeout.delay },
              }
            : null,
      } as any);
    },
  });
};

export const expectResourceStructure = (resource: Resource<any, any, any>) => {
  expect(resource).toHaveProperty("tag");
  expect(resource).toHaveProperty("options");
  expect(resource).toHaveProperty("load");

  expect(resource.tag).toHaveProperty("resource");
  expect(resource.tag).toHaveProperty("dependencies");
  expect(typeof resource.load).toBe("function");
};

export const expectResourceTag = (tag: ResourceTag) => {
  expect(tag).toHaveProperty("id");
  expect(typeof tag.id === "string" || Array.isArray(tag.id)).toBe(true);

  if (Array.isArray(tag.id)) {
    expect(tag.id.length).toBeGreaterThan(0);
  }
};

// React.cache와 같은 실제 메모이제이션 구현
const createReactCacheStyleMemo = () => {
  const globalCache = new Map<Function, Map<string, any>>();

  const memoFn = <T extends Function>(fn: T): T => {
    if (!globalCache.has(fn)) {
      globalCache.set(fn, new Map());
    }

    const fnCache = globalCache.get(fn)!;

    return ((...args: any[]) => {
      const cacheKey = JSON.stringify(args, (key, value) => {
        if (typeof value === "function") {
          return `[Function: ${value.name || "anonymous"}]`;
        }
        if (typeof value === "object" && value !== null) {
          try {
            return JSON.stringify(value);
          } catch {
            return `[Object: ${Object.prototype.toString.call(value)}]`;
          }
        }
        return value;
      });

      if (fnCache.has(cacheKey)) {
        return fnCache.get(cacheKey);
      }

      const result = fn(...args);
      fnCache.set(cacheKey, result);
      return result;
    }) as unknown as T;
  };

  return jest.fn(memoFn);
};

export const createMockDependencies = () => ({
  lifeCycleCache: createReactCacheStyleMemo(),
});

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Create mock LoaderID for testing (replaces createMockContextID)
export const createMockLoaderID = (): LoaderID => {
  return { __loaderID: Symbol("mock-loader-id") } as LoaderID;
};
