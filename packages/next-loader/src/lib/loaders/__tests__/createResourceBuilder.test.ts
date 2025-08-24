/* eslint-disable @typescript-eslint/no-explicit-any */
import { nanoid } from "nanoid";

import { createResourceBuilder } from "@/lib/loaders/createResourceBuilder";
import { __RESOURCE_ID } from "@/lib/models/resource";
import type { ResourceAdapter } from "@/lib/models/resourceAdapter";
import type { ResourceTag } from "@/lib/models/resourceTag";

import {
  createMockAdapter,
  type MockLoaderParam,
} from "../../../__tests__/__helpers__/mockResourceBuilder";
import {
  createDependentResourceBuilder,
  createHierarchicalResourceBuilder,
  createTestResourceBuilder,
  expectResourceStructure,
  expectResourceTag,
} from "../../../__tests__/__helpers__/testUtils";

jest.mock("nanoid");
const mockNanoid = nanoid as jest.MockedFunction<typeof nanoid>;

// Helper function to create mock loader options
const createMockLoaderOptions = () => ({
  retry: {
    count: 0,
    maxCount: 0,
    resetRetryCount: () => {},
    useFallbackOnNextRetry: () => {},
  },
  timeout: {
    delay: 1000,
    elapsedTime: 0,
    resetTimeout: () => {},
  },
});

const createMockRetry = (): never => {
  throw new Error("retry");
};

describe("createResourceBuilder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNanoid.mockImplementation(() => `mock-id-${Date.now()}`);
  });

  describe("Basic Resource Creation", () => {
    it("should create a resource with correct structure", () => {
      const factory = createTestResourceBuilder();
      const resource = factory({ id: "test-1" });

      expectResourceStructure(resource);
      expect(resource.tag.resource.identifier).toBe("test-resource-test-1");
      expect(resource.options).toEqual({});
      expect(typeof resource.load).toBe("function");
      expect(resource[__RESOURCE_ID]).toBeDefined();
    });

    it("should generate unique resource IDs using nanoid", () => {
      mockNanoid
        .mockReturnValueOnce("unique-id-1")
        .mockReturnValueOnce("unique-id-2");

      const factory = createTestResourceBuilder();
      const resource1 = factory({ id: "test-1" });
      const resource2 = factory({ id: "test-2" });

      expect(resource1[__RESOURCE_ID]).toBe("unique-id-1");
      expect(resource2[__RESOURCE_ID]).toBe("unique-id-2");
      expect(mockNanoid).toHaveBeenCalledTimes(2);
    });

    it("should apply resource options correctly", () => {
      const factory = createTestResourceBuilder({ staleTime: 5000 });
      const resource = factory({ id: "test-options" });

      expect(resource.options).toEqual({ staleTime: 5000 });
    });
  });

  describe("Tag System", () => {
    it("should create simple identifier tags", () => {
      const factory = createResourceBuilder({
        tags: (req: { id: string }) => ({
          identifier: `simple-${req.id}`,
        }),
        options: {},
        use: [],
        load: async ({ fetch, req }) => fetch({ data: req } as any),
      });

      const resource = factory({ id: "simple-test" });
      expectResourceTag(resource.tag.resource);
      expect(resource.tag.resource.identifier).toBe("simple-simple-test");
      expect((resource.tag.resource as any).effects).toBeUndefined();
    });

    it("should create hierarchical identifier tags", () => {
      const factory = createHierarchicalResourceBuilder();
      const resource = factory({ path: ["acme", "engineering", "john"] });

      expectResourceTag(resource.tag.resource);
      expect(resource.tag.resource.identifier).toEqual([
        "acme",
        "engineering",
        "john",
      ]);
      expect(resource.tag.resource.effects).toEqual([
        "acme-engineering-john-cache",
      ]);
    });

    it("should handle effects tags", () => {
      const factory = createTestResourceBuilder({
        effects: ["user-cache", "profile-stats"],
      });
      const resource = factory({ id: "effects-test" });

      expect(resource.tag.resource.effects).toEqual([
        "user-cache",
        "profile-stats",
      ]);
    });

    it("should throw error for empty hierarchical tags", () => {
      const factory = createResourceBuilder({
        tags: () => ({ identifier: [] }),
        options: {},
        use: [],
        load: async ({ fetch }) => fetch({} as any),
      });

      expect(() => {
        factory({ id: "test" });
      }).toThrow();
    });
  });

  describe("Dependency Management", () => {
    it("should handle resources without dependencies", () => {
      const factory = createTestResourceBuilder();
      const resource = factory({ id: "no-deps" });

      expect(resource.tag.dependencies).toEqual([]);
    });

    it("should collect dependency tags from single dependency", async () => {
      const parentBuilder = createTestResourceBuilder({
        effects: ["parent-effect"],
      });
      const parentResource = parentBuilder({ id: "parent" });

      const childBuilder = createDependentResourceBuilder([parentResource]);
      const childResource = childBuilder({ id: "child" });

      // Should include parent's identifier tag and effects
      expect(childResource.tag.dependencies).toContain("test-resource-parent");
      expect(childResource.tag.dependencies).toContain("parent-effect");
    });

    it("should collect dependency tags from multiple dependencies", async () => {
      const parent1 = createTestResourceBuilder({ effects: ["effect1"] })({
        id: "parent1",
      });
      const parent2 = createTestResourceBuilder({
        effects: ["effect2", "effect3"],
      })({ id: "parent2" });

      const childBuilder = createDependentResourceBuilder([parent1, parent2]);
      const childResource = childBuilder({ id: "multi-child" });

      const dependencies = childResource.tag.dependencies;
      expect(dependencies).toContain("test-resource-parent1");
      expect(dependencies).toContain("effect1");
      expect(dependencies).toContain("test-resource-parent2");
      expect(dependencies).toContain("effect2");
      expect(dependencies).toContain("effect3");
    });

    it("should handle hierarchical dependency tags", async () => {
      const hierarchicalBuilder = createHierarchicalResourceBuilder();
      const hierarchicalResource = hierarchicalBuilder({
        path: ["acme", "engineering"],
      });

      const childBuilder = createDependentResourceBuilder([
        hierarchicalResource,
      ]);
      const childResource = childBuilder({ id: "hierarchical-child" });

      // Should include last element of hierarchical identifier and effects
      expect(childResource.tag.dependencies).toContain("engineering"); // last element of hierarchy
      expect(childResource.tag.dependencies).toContain(
        "acme-engineering-cache",
      );
    });
  });

  describe("StaleTime Optimization", () => {
    it("should use own staleTime when no dependencies", () => {
      const factory = createTestResourceBuilder({ staleTime: 10000 });
      const resource = factory({ id: "own-staletime" });

      expect(resource.options.staleTime).toBe(10000);
    });

    it("should use minimum staleTime from dependencies", async () => {
      const parent1 = createTestResourceBuilder({ staleTime: 5000 })({
        id: "parent1",
      });
      const parent2 = createTestResourceBuilder({ staleTime: 3000 })({
        id: "parent2",
      });

      const childBuilder = createDependentResourceBuilder([parent1, parent2], {
        staleTime: 8000,
      });
      const childResource = childBuilder({ id: "min-staletime" });

      expect(childResource.options.staleTime).toBe(3000); // minimum of [8000, 5000, 3000]
    });

    it("should filter out undefined staleTime values", async () => {
      const parentWithoutStaleTime = createTestResourceBuilder()({
        id: "no-staletime",
      });
      const parentWithStaleTime = createTestResourceBuilder({
        staleTime: 7000,
      })({ id: "with-staletime" });

      const childBuilder = createDependentResourceBuilder(
        [parentWithoutStaleTime, parentWithStaleTime],
        { staleTime: 9000 },
      );
      const childResource = childBuilder({ id: "filtered-staletime" });

      expect(childResource.options.staleTime).toBe(7000); // minimum of [9000, 7000] (undefined filtered out)
    });

    it("should handle all undefined staleTime values", async () => {
      const parentWithoutStaleTime = createTestResourceBuilder()({
        id: "no-staletime",
      });

      const childBuilder = createDependentResourceBuilder([
        parentWithoutStaleTime,
      ]);
      const childResource = childBuilder({ id: "all-undefined" });

      expect(childResource.options.staleTime).toBeUndefined();
    });
  });

  describe("Load Function", () => {
    it("should execute load function with correct parameters", async () => {
      const adapter = createMockAdapter();
      const factory = createResourceBuilder({
        tags: (req: { id: string }) => ({ identifier: `load-test-${req.id}` }),
        options: { staleTime: 2000 },
        use: [],
        load: async ({ req, fetch }) => {
          return fetch({
            url: `/api/load/${req.id}`,
            data: { id: req.id, processed: true },
          } as any);
        },
      });

      const resource = factory({ id: "load-test" });
      const result = await resource.load(
        adapter,
        () => createMockLoaderOptions(),
        createMockRetry,
      );

      expect(result).toMatchObject({
        data: { id: "load-test", processed: true },
        tags: ["load-test-load-test"], // revalidation tags
        options: { staleTime: 2000 },
      });
    });

    it("should pass dependency promises to load function", async () => {
      const parentBuilder = createTestResourceBuilder();
      const parentResource = parentBuilder({ id: "parent-for-load" });

      const adapter = createMockAdapter();

      const childBuilder = createResourceBuilder({
        tags: (req: { id: string }) => ({ identifier: `child-${req.id}` }),
        options: {},
        use: [parentResource],
        load: async ({ req, use, fetch }) => {
          expect(use).toHaveLength(1);
          if (use.length > 0) {
            expect((use as any)[0]).toBeInstanceOf(Promise);
          }

          const parentResults = await Promise.all(use as any);
          const parentData =
            parentResults.length > 0 ? parentResults[0] : undefined;

          return fetch({
            url: `/api/child/${req.id}`,
            data: {
              id: req.id,
              parentData: (parentData as any)?.data,
              hasParent: true,
            },
          } as any);
        },
      });

      const childResource = childBuilder({ id: "child-load-test" });
      const result = await childResource.load(
        adapter,
        () => createMockLoaderOptions(),
        createMockRetry,
      );

      expect((result as any).data).toMatchObject({
        id: "child-load-test",
        hasParent: true,
      });
    });

    it("should build revalidation tags correctly", async () => {
      const parentBuilder = createTestResourceBuilder({
        effects: ["parent-cache"],
      });
      const parentResource = parentBuilder({ id: "revalidation-parent" });

      const adapter = jest.fn(createMockAdapter());

      const childBuilder = createResourceBuilder({
        tags: (req: { id: string }) => ({
          identifier: `child-${req.id}`,
          effects: ["child-effect"],
        }),
        options: { staleTime: 1000 },
        use: [parentResource],
        load: async ({ fetch }) => fetch({ data: "test" } as any),
      });

      const childResource = childBuilder({ id: "revalidation-test" });
      await childResource.load(
        adapter,
        () => createMockLoaderOptions(),
        createMockRetry,
      );

      expect(adapter).toHaveBeenCalledWith({
        tags: expect.arrayContaining([
          "child-revalidation-test", // own identifier
          "child-effect", // own effects
          "test-resource-revalidation-parent", // parent identifier
          "parent-cache", // parent effects
        ]),
        options: { staleTime: 1000 },
      });
    });
  });

  describe("Error Cases", () => {
    it("should propagate errors from load function", async () => {
      const adapter = createMockAdapter();

      const factory = createResourceBuilder({
        tags: () => ({ identifier: "error-test" }),
        options: {},
        use: [],
        load: async ({ fetch }) => {
          return fetch({
            shouldError: true,
            errorMessage: "Test load error",
          } as any);
        },
      });

      const resource = factory({ id: "error-test" });

      await expect(
        resource.load(
          adapter,
          () => createMockLoaderOptions(),
          createMockRetry,
        ),
      ).rejects.toThrow("Test load error");
    });

    it("should handle dependency resolution errors", async () => {
      const failingParentBuilder = createResourceBuilder({
        tags: () => ({ identifier: "failing-parent" }),
        options: {},
        use: [],
        load: async ({ fetch }) => {
          return fetch({
            shouldError: true,
            errorMessage: "Parent failed",
          } as any);
        },
      });

      const parentResource = failingParentBuilder({ id: "failing" });
      const adapter = createMockAdapter();

      const childBuilder = createResourceBuilder({
        tags: () => ({ identifier: "dependent-child" }),
        options: {},
        use: [parentResource],
        load: async ({ use, fetch }) => {
          // This should fail when trying to resolve parent
          await Promise.all(use);
          return fetch({ data: "should not reach here" } as any);
        },
      });

      const childResource = childBuilder({ id: "child" });

      await expect(
        childResource.load(
          adapter,
          () => createMockLoaderOptions(),
          createMockRetry,
        ),
      ).rejects.toThrow("Parent failed");
    });
  });

  describe("Type Safety", () => {
    it("should maintain type safety for request and response", async () => {
      interface TypedRequest {
        userId: number;
        includeMetadata: boolean;
      }

      interface TypedResponse {
        user: { id: number; name: string };
        metadata?: { lastLogin: string };
      }

      const typedBuilder = createResourceBuilder<
        TypedRequest,
        TypedResponse,
        ResourceTag,
        readonly []
      >({
        tags: (req) => ({ identifier: `user-${req.userId}` }),
        options: { staleTime: 5000 },
        use: [],
        load: async ({ req }) => {
          return {
            user: { id: req.userId, name: "Test User" },
            metadata: req.includeMetadata
              ? { lastLogin: new Date().toISOString() }
              : undefined,
          };
        },
      });

      const resource = typedBuilder({ userId: 123, includeMetadata: true });
      const adapter: ResourceAdapter<MockLoaderParam, TypedResponse> =
        () => async () => {
          return {
            user: { id: 123, name: "Test User" },
            metadata: { lastLogin: new Date().toISOString() },
          };
        };
      const result = await resource.load(
        adapter,
        () => createMockLoaderOptions(),
        createMockRetry,
      );

      expect(result.user.id).toBe(123);
      expect(result.metadata).toBeDefined();
    });
  });

  describe("LoaderOptions and Retry Integration", () => {
    it("should provide access to loaderOptions() within load function", async () => {
      const adapter = createMockAdapter();

      const factory = createResourceBuilder({
        tags: () => ({ identifier: "loader-options-test" }),
        options: {},
        use: [],
        load: async ({ req, fetch, loaderOptions }) => {
          // Access loader configuration during resource loading
          const config = loaderOptions();

          const response = await fetch({
            url: `/api/test/${(req as any).id}`,
            data: { id: (req as any).id },
          } as any);

          return {
            ...(response as any),
            // Include loader config in response for testing
            capturedLoaderConfig: {
              retry: config.retry,
              timeout: config.timeout,
            },
          };
        },
      });

      const resource = factory({ id: "loader-options" });

      // Simulate calling with specific loader options
      const mockLoaderOptions = () => ({
        retry: {
          count: 0,
          maxCount: 3,
          resetRetryCount: () => {},
          useFallbackOnNextRetry: () => {},
        },
        timeout: {
          delay: 5000,
          elapsedTime: 0,
          resetTimeout: () => {},
        },
      });

      const mockRetry = () => {
        throw new Error("Retry called");
      };

      const result = await resource.load(adapter, mockLoaderOptions, mockRetry);

      expect((result as any).capturedLoaderConfig).toEqual({
        retry: {
          count: 0,
          maxCount: 3,
          resetRetryCount: expect.any(Function),
          useFallbackOnNextRetry: expect.any(Function),
        },
        timeout: {
          delay: 5000,
          elapsedTime: 0,
          resetTimeout: expect.any(Function),
        },
      });
    });

    it("should provide access to retry() function within load function", async () => {
      const adapter = createMockAdapter();
      let retryCallCount = 0;

      const factory = createResourceBuilder({
        tags: () => ({ identifier: "retry-test" }),
        options: {},
        use: [],
        load: async ({ req, fetch, retry }) => {
          retryCallCount++;

          // Simulate a condition where retry is needed
          if (retryCallCount === 1) {
            // Call retry() on first attempt
            try {
              retry();
            } catch (error) {
              // retry() should throw an error to trigger retry mechanism
              expect(error).toBeDefined();
            }
          }

          const response = await fetch({
            url: `/api/test/${(req as any).id}`,
            data: { id: (req as any).id, attempt: retryCallCount },
          } as any);

          return {
            ...(response as any),
            retryCallCount,
          };
        },
      });

      const resource = factory({ id: "retry-test" });

      const mockLoaderOptions = () => ({
        retry: {
          count: 0,
          maxCount: 2,
          resetRetryCount: () => {},
          useFallbackOnNextRetry: () => {},
        },
        timeout: {
          delay: 5000,
          elapsedTime: 0,
          resetTimeout: () => {},
        },
      });

      const mockRetry = () => {
        throw new Error("Retry signal");
      };

      // First call should trigger retry
      try {
        await resource.load(adapter, mockLoaderOptions, mockRetry);
      } catch (error) {
        expect((error as any).message).toBe("Retry signal");
      }

      expect(retryCallCount).toBe(1);
    });

    it("should pass loaderOptions and retry to dependent resources", async () => {
      const adapter = createMockAdapter();
      let capturedOptions: any = null;

      // Create parent resource that captures loader options
      const parentBuilder = createResourceBuilder({
        tags: () => ({ identifier: "parent-with-options" }),
        options: {},
        use: [],
        load: async ({ req, fetch, loaderOptions }) => {
          capturedOptions = loaderOptions();

          const response = await fetch({
            url: `/api/parent/${(req as any).id}`,
            data: { id: (req as any).id },
          } as any);

          return { ...(response as any), type: "parent" };
        },
      });

      const parentResource = parentBuilder({ id: "parent" });

      // Create child resource that depends on parent
      const childBuilder = createResourceBuilder({
        tags: () => ({ identifier: "child-with-options" }),
        options: {},
        use: [parentResource],
        load: async ({ req, use, fetch, loaderOptions }) => {
          // This should receive the same loaderOptions and retry as parent
          const config = loaderOptions();
          const parentResults = await Promise.all(use);
          const firstParent = (parentResults as any[])[0];

          const response = await fetch({
            url: `/api/child/${(req as any).id}`,
            data: { id: (req as any).id, parent: firstParent },
          } as any);

          return {
            ...(response as any),
            type: "child",
            parentType: firstParent?.type,
            childLoaderConfig: {
              retry: config.retry,
              timeout: config.timeout,
            },
          };
        },
      });

      const childResource = childBuilder({ id: "child" });

      const mockLoaderOptions = () => ({
        retry: {
          count: 0,
          maxCount: 2,
          resetRetryCount: () => {},
          useFallbackOnNextRetry: () => {},
        },
        timeout: {
          delay: 3000,
          elapsedTime: 0,
          resetTimeout: () => {},
        },
      });

      const mockRetry = () => {
        throw new Error("Retry signal");
      };

      const result = await childResource.load(
        adapter,
        mockLoaderOptions,
        mockRetry,
      );

      // Verify both parent and child received the same loader options
      expect(capturedOptions).toEqual({
        retry: {
          count: 0,
          maxCount: 2,
          resetRetryCount: expect.any(Function),
          useFallbackOnNextRetry: expect.any(Function),
        },
        timeout: {
          delay: 3000,
          elapsedTime: 0,
          resetTimeout: expect.any(Function),
        },
      });

      expect((result as any).childLoaderConfig).toEqual({
        retry: {
          count: 0,
          maxCount: 2,
          resetRetryCount: expect.any(Function),
          useFallbackOnNextRetry: expect.any(Function),
        },
        timeout: {
          delay: 3000,
          elapsedTime: 0,
          resetTimeout: expect.any(Function),
        },
      });

      expect((result as any).type).toBe("child");
      expect((result as any).parentType).toBe("parent");
    });

    it("should handle loaderOptions gracefully when not provided", async () => {
      const adapter = createMockAdapter();

      const factory = createResourceBuilder({
        tags: () => ({ identifier: "no-options-test" }),
        options: {},
        use: [],
        load: async ({ req, fetch, loaderOptions }) => {
          // loaderOptions might be undefined in some contexts
          const config = loaderOptions ? loaderOptions() : null;

          const response = await fetch({
            url: `/api/test/${(req as any).id}`,
            data: { id: (req as any).id },
          } as any);

          return {
            ...(response as any),
            hasLoaderOptions: config !== null,
            configSnapshot: config,
          };
        },
      });

      const resource = factory({ id: "no-options" });

      // Call without loaderOptions (passing undefined)
      const result = await resource.load(
        adapter,
        undefined as any,
        (): never => {
          throw new Error("retry");
        },
      );

      expect((result as any).hasLoaderOptions).toBe(false);
      expect((result as any).configSnapshot).toBe(null);
    });
  });
});
