/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createResourceBuilder } from "@/lib/loaders/createResourceBuilder";
import type { Resource, ResourceFactory } from "@/lib/models/resource";
import { __RESOURCE_ID } from "@/lib/models/resource";
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
  dependencies?: Resource[];
}): ResourceFactory<
  TestResourceRequest,
  TestResourceResponse,
  ResourceTag,
  readonly string[]
> => {
  return createResourceBuilder({
    tags: (req) => ({
      identifier: `test-resource-${req.id}`,
      effects: options?.effects,
    }),
    options: { staleTime: options?.staleTime },
    use: options?.dependencies || [],
    load: async ({ req, fetch, loaderOptions }) => {
      const response = await fetch({
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
  return createResourceBuilder({
    tags: (req: { path: string[] }) => ({
      identifier: req.path,
      effects: [`${req.path.join("-")}-cache`],
    }),
    options: { staleTime: 2000 },
    use: [],
    load: async ({ req, fetch, loaderOptions }) => {
      return fetch({
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
  return createResourceBuilder({
    tags: (req: { id: string }) => ({
      identifier: `dependent-${req.id}`,
      effects: ["dependent-cache"],
    }),
    options: { staleTime: options?.staleTime },
    use: parentResources,
    load: async ({ req, use, fetch, loaderOptions }) => {
      const parents = await Promise.all(use);
      return fetch({
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
  expect(resource[__RESOURCE_ID]).toBeDefined();

  expect(resource.tag).toHaveProperty("resource");
  expect(resource.tag).toHaveProperty("dependencies");
  expect(typeof resource.load).toBe("function");
};

export const expectResourceTag = (tag: ResourceTag) => {
  expect(tag).toHaveProperty("identifier");
  expect(
    typeof tag.identifier === "string" || Array.isArray(tag.identifier),
  ).toBe(true);

  if (Array.isArray(tag.identifier)) {
    expect(tag.identifier.length).toBeGreaterThan(0);
  }
};

export const createMockDependencies = () => ({
  memo: jest.fn(<T extends Function>(fn: T): T => fn),
  adapter: createMockAdapter(),
  revalidate: jest.fn(),
});

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
