/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createResourceBuilder } from "@/lib/loaders/createResourceBuilder";
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
  return createResourceBuilder({
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
  return createResourceBuilder({
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
  return createResourceBuilder({
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
      // 인자를 기반으로 캐시 키 생성 (React.cache 스타일)
      const cacheKey = JSON.stringify(args, (key, value) => {
        // 함수와 객체의 경우 toString을 사용하여 참조 문제 해결
        if (typeof value === "function") {
          return `[Function: ${value.name || "anonymous"}]`;
        }
        if (typeof value === "object" && value !== null) {
          // 순환참조 방지를 위한 간단한 직렬화
          try {
            return JSON.stringify(value);
          } catch {
            return `[Object: ${Object.prototype.toString.call(value)}]`;
          }
        }
        return value;
      });

      if (fnCache.has(cacheKey)) {
        // 캐시된 결과 반환 (React.cache와 동일한 동작)
        return fnCache.get(cacheKey);
      }

      // 새로운 결과 계산 및 캐시 저장
      const result = fn(...args);
      fnCache.set(cacheKey, result);
      return result;
    }) as T;
  };

  // Jest spy 기능 추가
  return jest.fn(memoFn);
};

export const createMockDependencies = () => ({
  memo: createReactCacheStyleMemo(),
  adapter: createMockAdapter(),
  revalidate: jest.fn(),
});

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
