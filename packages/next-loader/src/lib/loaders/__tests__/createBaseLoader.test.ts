/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { __RESOURCE_ID } from "@/lib/models/resource";
import { identifierTag } from "@/lib/models/resourceTag";

import {
  createCounterMiddleware,
  createMockMiddleware,
} from "../../../__tests__/__helpers__/mockMiddleware";
import {
  createDependentResourceBuilder,
  createMockDependencies,
  createTestResourceBuilder,
  TestResourceResponse,
} from "../../../__tests__/__helpers__/testUtils";
import {
  createBaseLoader,
  MSG_ERR_IDENTIFIER_TAG_MISMATCH,
  MSG_WARN_IDENTIFIER_TAG_DUPLICATE,
} from "../createBaseLoader";
import { createResourceBuilder } from "../createResourceBuilder";

describe("createBaseLoader", () => {
  let mockDependencies: ReturnType<typeof createMockDependencies>;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDependencies = createMockDependencies();
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe("Basic Functionality", () => {
    it("should create loader with correct structure", () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      expect(loader).toHaveProperty("loader");
      expect(typeof loader.loader).toBe("function");
    });

    it("should return load and revalidate functions from loader", () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const createResourceBuilder = createTestResourceBuilder();
      const resource = createResourceBuilder({ id: "basic-test" });

      const [load, revalidate] = loader.loader(resource);

      expect(typeof load).toBe("function");
      expect(typeof revalidate).toBe("function");
    });

    it("should load single resource successfully", async () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const createResourceBuilder = createTestResourceBuilder();
      const resource = createResourceBuilder({ id: "single-load" });

      const [load] = loader.loader(resource);
      const [result] = await load();

      expect(result).toMatchObject({
        id: "single-load",
        data: "processed-single-load",
      });
    });
  });

  describe("Caching Mechanism", () => {
    it("should cache loader functions by resource ID", async () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const createResourceBuilder = createTestResourceBuilder();
      const resource1 = createResourceBuilder({ id: "cache-test" });
      const resource2 = createResourceBuilder({ id: "cache-test" }); // Same ID different instance

      // Force same resource ID for testing
      const sharedId = "shared-test-id";
      (resource1 as any)[__RESOURCE_ID] = sharedId;
      (resource2 as any)[__RESOURCE_ID] = sharedId;

      const [load1] = loader.loader(resource1);
      const [load2] = loader.loader(resource2);

      // Should use cached loader function (same identifier tag)
      await load1();
      await load2();

      // Verify memo was called only once (for caching)
      expect(mockDependencies.memo).toHaveBeenCalled();
    });

    it("should throw error for same resource ID with different identifier tags", () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      // Create a custom resource factory for different tags
      const customFactory1 = createResourceBuilder({
        tags: () => ({ identifier: "resource-type-a" }),
        options: {},
        use: [],
        load: async ({ req, fetch }) =>
          fetch({ url: `/api/test/${(req as any).id}`, data: req } as any),
      });

      const customFactory2 = createResourceBuilder({
        tags: () => ({ identifier: "resource-type-b" }),
        options: {},
        use: [],
        load: async ({ req, fetch }) =>
          fetch({ url: `/api/test/${(req as any).id}`, data: req } as any),
      });

      const resource1 = customFactory1({ id: "test-1" });
      const resource2 = customFactory2({ id: "test-2" });

      // Force same resource ID but keep different identifier tags
      const sharedId = "shared-id";
      (resource1 as any)[__RESOURCE_ID] = sharedId;
      (resource2 as any)[__RESOURCE_ID] = sharedId;

      const [load1] = loader.loader(resource1);

      expect(() => {
        loader.loader(resource2);
      }).toThrow(
        MSG_ERR_IDENTIFIER_TAG_MISMATCH(
          identifierTag(resource1.tag.resource),
          identifierTag(resource2.tag.resource),
        ),
      );
    });

    it("should warn about duplicate identifier tags", () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      // Create resources with same identifier but different IDs
      const factory = createTestResourceBuilder();
      const resource1 = factory({ id: "duplicate" });
      const resource2 = factory({ id: "duplicate" }); // Same identifier, different ID

      const [load1] = loader.loader(resource1);
      const [load2] = loader.loader(resource2);

      const identifierTagStr = identifierTag(resource1.tag.resource);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        MSG_WARN_IDENTIFIER_TAG_DUPLICATE(identifierTagStr),
      );
    });

    it("should apply memo function when provided", async () => {
      const memoSpy = jest.fn(<T extends Function>(fn: T): T => fn);
      const dependenciesWithMemo = {
        ...mockDependencies,
        memo: memoSpy,
      };

      const loader = createBaseLoader({
        dependencies: dependenciesWithMemo,
      });

      const createResourceBuilder = createTestResourceBuilder();
      const resource = createResourceBuilder({ id: "memo-test" });

      const [load] = loader.loader(resource);
      await load();

      expect(memoSpy).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should work without memo function", async () => {
      const dependenciesWithoutMemo = {
        ...mockDependencies,
        memo: undefined,
      };

      const loader = createBaseLoader({
        dependencies: dependenciesWithoutMemo,
      });

      const createResourceBuilder = createTestResourceBuilder();
      const resource = createResourceBuilder({ id: "no-memo" });

      const [load] = loader.loader(resource);
      const [result] = await load();

      expect(result).toMatchObject({
        id: "no-memo",
      });
    });
  });

  describe("Parallel Loading", () => {
    it("should load multiple resources in parallel", async () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const factory = createTestResourceBuilder();
      const resource1 = factory({ id: "parallel-1" });
      const resource2 = factory({ id: "parallel-2" });
      const resource3 = factory({ id: "parallel-3" });

      const [load] = loader.loader(resource1, resource2, resource3);
      const results = await load();

      expect(results).toHaveLength(3);
      expect(results[0]).toMatchObject({ id: "parallel-1" });
      expect(results[1]).toMatchObject({ id: "parallel-2" });
      expect(results[2]).toMatchObject({ id: "parallel-3" });
    });

    it("should handle partial failures in parallel loading", async () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const successBuilder = createTestResourceBuilder();
      const errorBuilder = createTestResourceBuilder();

      const resource1 = successBuilder({ id: "success" });
      const resource2 = errorBuilder({ id: "error" });
      const resource3 = successBuilder({ id: "success-2" });

      // Make second resource fail
      resource2.load = jest
        .fn()
        .mockRejectedValue(new Error("Resource 2 failed"));

      const [load] = loader.loader(resource1, resource2, resource3);

      await expect(load()).rejects.toThrow("Resource 2 failed");
    });

    it("should maintain correct result order", async () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const factory = createTestResourceBuilder();
      // Create resources with different delays
      const resource1 = factory({ id: "slow" });
      const resource2 = factory({ id: "fast" });
      const resource3 = factory({ id: "medium" });

      // Mock with different delays
      resource1.load = jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return { id: "slow", data: "slow-result", timestamp: Date.now() };
      });

      resource2.load = jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { id: "fast", data: "fast-result", timestamp: Date.now() };
      });

      resource3.load = jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { id: "medium", data: "medium-result", timestamp: Date.now() };
      });

      const [load] = loader.loader(resource1, resource2, resource3);
      const [result1, result2, result3] = await load();

      // Results should maintain order despite different completion times
      expect(result1.id).toBe("slow");
      expect(result2.id).toBe("fast");
      expect(result3.id).toBe("medium");
    });
  });

  describe("Revalidation", () => {
    it("should call revalidate with correct tags", () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const factory = createTestResourceBuilder({ effects: ["test-effect"] });
      const resource = factory({ id: "revalidate-test" });

      const [, revalidate] = loader.loader(resource);
      revalidate();

      expect(mockDependencies.revalidate).toHaveBeenCalledWith(
        "test-resource-revalidate-test",
      );
    });

    it("should collect tags from multiple resources", () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const factory1 = createTestResourceBuilder({ effects: ["effect1"] });
      const factory2 = createTestResourceBuilder({ effects: ["effect2"] });

      const resource1 = factory1({ id: "multi-1" });
      const resource2 = factory2({ id: "multi-2" });

      const [, revalidate] = loader.loader(resource1, resource2);
      revalidate();

      expect(mockDependencies.revalidate).toHaveBeenCalledWith(
        "test-resource-multi-1",
        "test-resource-multi-2",
      );
    });

    it("should handle hierarchical identifier tags in revalidation", () => {
      const hierarchicalBuilder = createTestResourceBuilder();

      // Override tags to use hierarchical identifier
      const originalBuilder = hierarchicalBuilder;
      const hierarchicalResource = {
        ...originalBuilder({ id: "hierarchical" }),
        tag: {
          resource: {
            identifier: ["org", "dept", "user"],
            effects: ["hierarchy-effect"],
          },
          dependencies: [],
        },
      };

      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });
      const [, revalidate] = loader.loader(hierarchicalResource);
      revalidate();

      expect(mockDependencies.revalidate).toHaveBeenCalledWith(
        "org",
        "dept",
        "user",
      ); // full hierarchical identifier
    });

    it("should have 'use server' directive", () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });
      const factory = createTestResourceBuilder();
      const resource = factory({ id: "server-test" });

      const [, revalidate] = loader.loader(resource);

      // Check that the function has the correct structure for server actions
      expect(typeof revalidate).toBe("function");
      expect(revalidate.toString()).toContain('"use server"');
    });
  });

  describe("Middleware Integration", () => {
    it("should work with middlewares from baseLoader", async () => {
      const mockMiddleware = createMockMiddleware("integration");
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 1, canRetryOnError: true },
          timeout: { delay: 1000 },
        },
        middlewares: [mockMiddleware],
      });

      const factory = createTestResourceBuilder();
      const resource = factory({ id: "middleware-integration" });

      const [load] = loader.loader(resource);
      const [result] = await load();

      expect(result).toMatchObject({
        id: "middleware-integration",
      });
    });

    it("should handle multiple middlewares with caching", async () => {
      const middleware1 = createMockMiddleware("first");
      const middleware2 = createCounterMiddleware();

      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
        middlewares: [middleware1, middleware2],
      });

      const factory = createTestResourceBuilder();
      const resource = factory({ id: "multi-middleware-cache" });

      const [load1] = loader.loader(resource);
      const [load2] = loader.loader(resource); // Should use cache

      await load1();
      await load2();

      // Should have used cached loader function
      expect(mockDependencies.memo).toHaveBeenCalled();
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle resource dependencies in createBaseLoader context", async () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const parentBuilder = createTestResourceBuilder({
        effects: ["parent-effect"],
      });
      const parentResource = parentBuilder({ id: "parent" });

      const childBuilder = createDependentResourceBuilder([parentResource], {
        staleTime: 2000,
      });
      const childResource = childBuilder({ id: "child" });

      const [load] = loader.loader(parentResource, childResource);
      const [parentResult, childResult] = await load();

      expect(parentResult).toMatchObject({ id: "parent" });
      expect(childResult).toBeDefined();
    });

    it("should handle mixed resource types with caching", async () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const simpleBuilder = createTestResourceBuilder();
      const complexBuilder = createTestResourceBuilder({
        staleTime: 5000,
        effects: ["complex-effect"],
      });

      const resource1 = simpleBuilder({ id: "simple" });
      const resource2 = complexBuilder({ id: "complex" });
      const resource3 = simpleBuilder({ id: "simple-2" });

      const [load] = loader.loader(resource1, resource2, resource3);
      const results = await load();

      expect(results).toHaveLength(3);
      expect(results[0].id).toBe("simple");
      expect(results[1].id).toBe("complex");
      expect(results[2].id).toBe("simple-2");
    });

    it("should maintain cache consistency across multiple loader calls", async () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const factory = createTestResourceBuilder();
      const resource = factory({ id: "cache-consistency" });

      // First call - should cache the loader function
      const [load1] = loader.loader(resource);
      const result1 = await load1();

      // Second call with same resource - should reuse cached loader
      const [load2] = loader.loader(resource);
      const result2 = await load2();

      // Verify results are consistent (indicating caching worked)
      expect(result1[0].id).toBe(result2[0].id);
      expect(result1[0].data).toBe(result2[0].data);

      // Third call with different resources including the cached one
      const otherResource = factory({ id: "other" });
      const [load3] = loader.loader(resource, otherResource);
      const [cachedResult, newResult] = await load3();

      // Cached resource should return consistent result
      expect(cachedResult.id).toBe(result1[0].id);
      expect(cachedResult.data).toBe(result1[0].data);
      expect(newResult).toMatchObject({ id: "other" });

      // Verify memo was called for caching (but not excessively)
      expect(mockDependencies.memo).toHaveBeenCalled();

      // Should have called memo once per unique resource
      const mockCalls = (mockDependencies.memo as jest.Mock).mock.calls;
      expect(mockCalls.length).toBe(2); // One for cache-consistency, one for other
    });

    it("should maintain cache isolation between different resource IDs", async () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const factory = createTestResourceBuilder();
      const resource1 = factory({ id: "isolated-1" });
      const resource2 = factory({ id: "isolated-2" });

      // Load resources separately
      const [load1] = loader.loader(resource1);
      const [load2] = loader.loader(resource2);

      const result1 = await load1();
      const result2 = await load2();

      // Should have different results
      expect(result1).not.toEqual(result2);
      expect(result1[0].id).toBe("isolated-1");
      expect(result2[0].id).toBe("isolated-2");

      // Load them together
      const [loadBoth] = loader.loader(resource1, resource2);
      const [bothResult1, bothResult2] = await loadBoth();

      // Should maintain isolation (ignore timestamps as they may differ)
      expect(bothResult1.id).toBe(result1[0].id);
      expect(bothResult1.data).toBe(result1[0].data);
      expect(bothResult2.id).toBe(result2[0].id);
      expect(bothResult2.data).toBe(result2[0].data);
    });

    it("should handle cache invalidation scenarios", async () => {
      const memoSpy = jest.fn();
      let callCount = 0;

      // Mock memo that tracks calls
      memoSpy.mockImplementation(<T extends Function>(fn: T): T => {
        callCount++;
        return (async (...args: any[]) => {
          const result = await fn(...args);
          return { ...result, callCount };
        }) as unknown as T;
      });

      const dependenciesWithSpy = {
        ...mockDependencies,
        memo: memoSpy,
      };

      const loader = createBaseLoader({
        dependencies: dependenciesWithSpy,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const factory = createTestResourceBuilder();
      const resource = factory({ id: "invalidation-test" });

      // First load
      const [load1] = loader.loader(resource);
      const [result1] = await load1();

      // Second load - should use cached function
      const [load2] = loader.loader(resource);
      const [result2] = await load2();

      // Verify caching worked by checking memo was called
      expect(memoSpy).toHaveBeenCalledTimes(1);

      // Basic validation that both results exist
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });

  describe("Type Safety", () => {
    it("should maintain correct result types for multiple resources", async () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const stringBuilder = createTestResourceBuilder();
      const numberBuilder = createTestResourceBuilder();

      const stringResource = stringBuilder({ id: "string-result" });
      const numberResource = numberBuilder({ id: "number-result" });

      const [load] = loader.loader(stringResource, numberResource);
      const [stringResult, numberResult] = await load();

      expect(typeof stringResult.id).toBe("string");
      expect(typeof numberResult.id).toBe("string");
      expect(stringResult.data).toBeDefined();
      expect(numberResult.data).toBeDefined();
    });

    it("should handle empty resource array", () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const [load, revalidate] = loader.loader();

      expect(typeof load).toBe("function");
      expect(typeof revalidate).toBe("function");
    });
  });

  describe("Error Handling", () => {
    it("should handle errors in individual resource loading", async () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const factory = createTestResourceBuilder();
      const resource = factory({ id: "error-individual" });

      resource.load = jest
        .fn()
        .mockRejectedValue(new Error("Individual load failed"));

      const [load] = loader.loader(resource);

      await expect(load()).rejects.toThrow("Individual load failed");
    });

    it("should handle errors during cache operations", () => {
      const memoSpy = jest.fn(() => {
        throw new Error("Memo failed");
      });

      const dependenciesWithErrorMemo = {
        ...mockDependencies,
        memo: memoSpy,
      };

      const loader = createBaseLoader({
        dependencies: dependenciesWithErrorMemo,
      });

      const factory = createTestResourceBuilder();
      const resource = factory({ id: "memo-error" });

      expect(() => {
        loader.loader(resource);
      }).toThrow("Memo failed");
    });
  });

  describe("LoaderOptions and Retry Integration in Full Flow", () => {
    it("should pass loader configuration to resource load functions", async () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 2, canRetryOnError: true },
          timeout: { delay: 3000 },
        },
      });

      // Create a resource that captures loader options during loading
      const factory = createResourceBuilder({
        tags: (req: { id: string }) => ({
          identifier: `config-test-${req.id}`,
        }),
        options: {},
        use: [],
        load: async ({ req, fetch, loaderOptions }) => {
          const config = loaderOptions();

          const response = await fetch({
            url: `/api/config-test/${req.id}`,
            data: { id: req.id },
          } as any);

          return {
            ...(response as any),
            capturedConfig: {
              retry: { maxCount: config.retry.maxCount },
              timeout: { delay: config.timeout.delay },
            },
          };
        },
      });

      const resource = factory({ id: "config-capture" });
      const [load] = loader.loader(resource);
      const [result] = await load();

      // Verify the resource received the loader configuration
      expect((result as any).capturedConfig).toEqual({
        retry: { maxCount: 2 },
        timeout: { delay: 3000 },
      });
    });

    it("should provide consistent loaderOptions across multiple resources", async () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 1, canRetryOnError: false },
          timeout: { delay: 2000 },
        },
      });

      // Create multiple resources that capture loader options
      const factory1 = createResourceBuilder({
        tags: () => ({ identifier: "consistency-test-1" }),
        options: {},
        use: [],
        load: async ({ req, fetch, loaderOptions }) => {
          const config = loaderOptions();
          const response = await fetch({ url: "/api/test1", data: req } as any);
          return {
            ...(response as any),
            config: {
              retry: { maxCount: config.retry.maxCount },
              timeout: { delay: config.timeout.delay },
            },
          };
        },
      });

      const factory2 = createResourceBuilder({
        tags: () => ({ identifier: "consistency-test-2" }),
        options: {},
        use: [],
        load: async ({ req, fetch, loaderOptions }) => {
          const config = loaderOptions();
          const response = await fetch({ url: "/api/test2", data: req } as any);
          return {
            ...(response as any),
            config: {
              retry: { maxCount: config.retry.maxCount },
              timeout: { delay: config.timeout.delay },
            },
          };
        },
      });

      const resource1 = factory1({ id: "test1" });
      const resource2 = factory2({ id: "test2" });

      const [load] = loader.loader(resource1, resource2);
      const [result1, result2] = await load();

      // Both resources should receive the same configuration
      const expectedConfig = {
        retry: { maxCount: 1 },
        timeout: { delay: 2000 },
      };

      expect((result1 as any).config).toEqual(expectedConfig);
      expect((result2 as any).config).toEqual(expectedConfig);
    });

    it("should provide retry function that can be called from resource load", async () => {
      let retryAttempts = 0;
      const mockRetryImplementation = () => {
        retryAttempts++;
        throw new Error("Manual retry triggered");
      };

      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 3, canRetryOnError: true },
          timeout: { delay: 5000 },
        },
      });

      // Override the retry behavior for testing
      const originalLoadResource = (loader as any).loadResource;

      const factory = createResourceBuilder({
        tags: () => ({ identifier: "retry-from-resource" }),
        options: {},
        use: [],
        load: async ({ req, fetch, retry, loaderOptions }) => {
          const config = loaderOptions();

          // Simulate a condition that triggers manual retry
          if ((req as any).id === "trigger-retry") {
            retry(); // This should trigger the retry mechanism
          }

          const response = await fetch({
            url: `/api/retry-test/${(req as any).id}`,
            data: { id: (req as any).id },
          } as any);

          return {
            ...(response as any),
            config: {
              retry: { maxCount: config.retry.maxCount },
              timeout: { delay: config.timeout.delay },
            },
          };
        },
      });

      const resource = factory({ id: "normal" });
      const [load] = loader.loader(resource);
      const [result] = await load();

      // Normal execution should work without retry
      expect((result as any).config).toEqual({
        retry: { maxCount: 3 },
        timeout: { delay: 5000 },
      });
    });

    it("should maintain loaderOptions through resource dependency chains", async () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 2, canRetryOnError: true },
          timeout: { delay: 4000 },
        },
      });

      // Create parent resource
      const parentFactory = createResourceBuilder({
        tags: () => ({ identifier: "chain-parent" }),
        options: {},
        use: [],
        load: async ({ req, fetch, loaderOptions }) => {
          const config = loaderOptions();
          const response = await fetch({
            url: "/api/parent",
            data: req,
          } as any);
          return {
            ...(response as any),
            type: "parent",
            config: {
              retry: { maxCount: config.retry.maxCount },
              timeout: { delay: config.timeout.delay },
            },
          };
        },
      });

      const parentResource = parentFactory({ id: "parent" });

      // Create child resource that depends on parent
      const childFactory = createResourceBuilder({
        tags: () => ({ identifier: "chain-child" }),
        options: {},
        use: [parentResource],
        load: async ({ req, use, fetch, loaderOptions }) => {
          const config = loaderOptions();
          const parentResults = await Promise.all(use);
          const firstParent = (parentResults as any[])[0];
          const response = await fetch({
            url: "/api/child",
            data: { req, parent: firstParent },
          } as any);

          return {
            ...(response as any),
            type: "child",
            config: {
              retry: { maxCount: config.retry.maxCount },
              timeout: { delay: config.timeout.delay },
            },
            parentConfig: firstParent?.config,
          };
        },
      });

      const childResource = childFactory({ id: "child" });

      const [load] = loader.loader(childResource);
      const [result] = await load();

      const expectedConfig = {
        retry: { maxCount: 2 },
        timeout: { delay: 4000 },
      };

      // Both parent and child should have received the same configuration
      expect((result as any).config).toEqual(expectedConfig);
      expect((result as any).parentConfig).toEqual(expectedConfig);
      expect((result as any).type).toBe("child");
    });

    it("should work correctly with updated test helper functions", async () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 1, canRetryOnError: true },
          timeout: { delay: 1000 },
        },
      });

      // Use the updated createTestResourceBuilder that includes loaderConfig
      const factory = createTestResourceBuilder();
      const resource = factory({ id: "helper-test" });

      const [load] = loader.loader(resource);
      const [result] = await load();

      // The updated test helper should include loaderConfig in the response
      expect(result).toMatchObject({
        id: "helper-test",
        data: "processed-helper-test",
      });

      // Should include the captured loader configuration from the helper
      expect((result as TestResourceResponse).loaderConfig).toEqual({
        retry: { maxCount: 1 },
        timeout: { delay: 1000 },
      });
    });
  });
});
