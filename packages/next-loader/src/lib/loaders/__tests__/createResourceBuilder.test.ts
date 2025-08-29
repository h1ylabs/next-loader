/* eslint-disable @typescript-eslint/no-explicit-any */
import type { LoaderContextID } from "@h1y/loader-core";

import { createMockAdapter } from "@/__tests__/__helpers__/mockResourceBuilder";
import {
  createDependentResourceBuilder,
  createHierarchicalResourceBuilder,
  createTestResourceBuilder,
  expectResourceStructure,
  expectResourceTag,
} from "@/__tests__/__helpers__/testUtils";
import { createResourceBuilder } from "@/lib/loaders/createResourceBuilder";
import type { ResourceTag } from "@/lib/models/resourceTag";

// Helper function to create mock loader options
const createMockLoaderOptions = () => ({
  retry: {
    count: 0,
    maxCount: 0,
    resetRetryCount: () => {},
  },
  timeout: {
    delay: 1000,
    elapsedTime: 0,
    resetTimeout: () => {},
  },
  metadata: {
    contextID: { __loaderContextID: Symbol() as any } as LoaderContextID,
  },
});

// Helper function to create a proper contextID for tests
const createMockContextID = () =>
  ({ __loaderContextID: Symbol() as any }) as LoaderContextID;

const createMockRetry = (): never => {
  throw new Error("retry");
};

describe("createResourceBuilder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Resource Creation", () => {
    it("should create a resource with correct structure", () => {
      const factory = createTestResourceBuilder();
      const resource = factory({ id: "test-1" });

      expectResourceStructure(resource);
      expect(resource.tag.resource.id).toBe("test-resource-test-1");
      expect(resource.options).toEqual({});
      expect(typeof resource.load).toBe("function");
    });

    it("should apply resource options correctly", () => {
      const factory = createTestResourceBuilder({ staleTime: 5000 });
      const resource = factory({ id: "test-options" });

      expect(resource.options).toEqual({ staleTime: 5000 });
    });
  });

  describe("Tag System", () => {
    it("should create simple id tags", () => {
      const factory = createResourceBuilder({
        tags: (req: { id: string }) => ({
          id: `simple-${req.id}`,
        }),
        load: async ({ fetcher, req }) => {
          const { load } = fetcher(createMockAdapter());
          return load({ data: req } as any);
        },
      });

      const resource = factory({ id: "simple-test" });
      expectResourceTag(resource.tag.resource);
      expect(resource.tag.resource.id).toBe("simple-simple-test");
      expect((resource.tag.resource as any).effects).toBeUndefined();
    });

    it("should create hierarchical id tags", () => {
      const factory = createHierarchicalResourceBuilder();
      const resource = factory({ path: ["acme", "engineering", "john"] });

      expectResourceTag(resource.tag.resource);
      expect(resource.tag.resource.id).toEqual(["acme", "engineering", "john"]);
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
        tags: () => ({ id: [] }),
        load: async ({ fetcher }) => {
          const { load } = fetcher(createMockAdapter());
          return load({} as any);
        },
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

      // Should include parent's id tag and effects
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

      // Should include last element of hierarchical id and effects
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
      const factory = createResourceBuilder({
        tags: (req: { id: string }) => ({ id: `load-test-${req.id}` }),
        options: { staleTime: 2000 },
        load: async ({ req, fetcher }) => {
          const { load } = fetcher(createMockAdapter());
          return load({
            url: `/api/load/${req.id}`,
            data: { id: req.id, processed: true },
          } as any);
        },
      });

      const resource = factory({ id: "load-test" });
      const result = await resource.load(
        () => createMockLoaderOptions(),
        createMockRetry,
        createMockContextID(),
        (fn) => fn,
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

      const childBuilder = createResourceBuilder({
        tags: (req: { id: string }) => ({ id: `child-${req.id}` }),
        use: () => [parentResource],
        load: async ({ req, use, fetcher }) => {
          expect(use).toHaveLength(1);
          if (use.length > 0) {
            expect((use as any)[0]).toBeInstanceOf(Promise);
          }

          const parentResults = await Promise.all(use as any);
          const parentData =
            parentResults.length > 0 ? parentResults[0] : undefined;

          const { load } = fetcher(createMockAdapter());
          return load({
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
        () => createMockLoaderOptions(),
        createMockRetry,
        createMockContextID(),
        (fn) => fn,
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
          id: `child-${req.id}`,
          effects: ["child-effect"],
        }),
        options: { staleTime: 1000 },
        use: () => [parentResource],
        load: async ({ fetcher }) => {
          const { load } = fetcher(adapter);
          return load({ data: "test" } as any);
        },
      });

      const childResource = childBuilder({ id: "revalidation-test" });
      await childResource.load(
        () => createMockLoaderOptions(),
        createMockRetry,
        createMockContextID(),
        (fn) => fn,
      );

      expect(adapter).toHaveBeenCalledWith({
        tags: expect.arrayContaining([
          "child-revalidation-test", // own id
          "child-effect", // own effects
          "test-resource-revalidation-parent", // parent id
          "parent-cache", // parent effects
        ]),
        options: { staleTime: 1000 },
      });
    });
  });

  describe("Error Cases", () => {
    it("should propagate errors from load function", async () => {
      const factory = createResourceBuilder({
        tags: () => ({ id: "error-test" }),
        load: async ({ fetcher }) => {
          const { load } = fetcher(createMockAdapter());
          return load({
            shouldError: true,
            errorMessage: "Test load error",
          } as any);
        },
      });

      const resource = factory({ id: "error-test" });

      await expect(
        resource.load(
          () => createMockLoaderOptions(),
          createMockRetry,
          createMockContextID(),
          (fn) => fn,
        ),
      ).rejects.toThrow("Test load error");
    });

    it("should handle dependency resolution errors", async () => {
      const failingParentBuilder = createResourceBuilder({
        tags: () => ({ id: "failing-parent" }),
        load: async ({ fetcher }) => {
          const { load } = fetcher(createMockAdapter());
          return load({
            shouldError: true,
            errorMessage: "Parent failed",
          } as any);
        },
      });

      const parentResource = failingParentBuilder({ id: "failing" });

      const childBuilder = createResourceBuilder({
        tags: () => ({ id: "dependent-child" }),
        use: () => [parentResource],
        load: async ({ use, fetcher }) => {
          // This should fail when trying to resolve parent
          await Promise.all(use);
          const { load } = fetcher(createMockAdapter());
          return load({ data: "should not reach here" } as any);
        },
      });

      const childResource = childBuilder({ id: "child" });

      await expect(
        childResource.load(
          () => createMockLoaderOptions(),
          createMockRetry,
          createMockContextID(),
          (fn) => fn,
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
        tags: (req) => ({ id: `user-${req.userId}` }),
        options: { staleTime: 5000 },
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
      const result = await resource.load(
        () => createMockLoaderOptions(),
        createMockRetry,
        createMockContextID(),
        (fn) => fn,
      );

      expect(result.user.id).toBe(123);
      expect(result.metadata).toBeDefined();
    });
  });

  describe("LoaderOptions and Retry Integration", () => {
    it("should provide access to loaderOptions() within load function", async () => {
      const factory = createResourceBuilder({
        tags: () => ({ id: "loader-options-test" }),
        load: async ({ req, fetcher, loaderOptions }) => {
          // Access loader configuration during resource loading
          const config = loaderOptions();

          const { load } = fetcher(createMockAdapter());
          const response = await load({
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
        },
        timeout: {
          delay: 5000,
          elapsedTime: 0,
          resetTimeout: () => {},
        },
        metadata: {
          contextID: createMockContextID(),
        },
      });

      const mockRetry = () => {
        throw new Error("Retry called");
      };

      const result = await resource.load(
        mockLoaderOptions,
        mockRetry,
        createMockContextID(),
        (fn) => fn,
      );

      expect((result as any).capturedLoaderConfig).toEqual({
        retry: {
          count: 0,
          maxCount: 3,
          resetRetryCount: expect.any(Function),
        },
        timeout: {
          delay: 5000,
          elapsedTime: 0,
          resetTimeout: expect.any(Function),
        },
      });
    });

    it("should provide access to retry() function within load function", async () => {
      let retryCallCount = 0;

      const factory = createResourceBuilder({
        tags: () => ({ id: "retry-test" }),
        load: async ({ req, fetcher, retry }) => {
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

          const { load } = fetcher(createMockAdapter());
          const response = await load({
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
        },
        timeout: {
          delay: 5000,
          elapsedTime: 0,
          resetTimeout: () => {},
        },
        metadata: {
          contextID: createMockContextID(),
        },
      });

      const mockRetry = () => {
        throw new Error("Retry signal");
      };

      // First call should trigger retry
      try {
        await resource.load(
          mockLoaderOptions,
          mockRetry,
          createMockContextID(),
          (fn) => fn,
        );
      } catch (error) {
        expect((error as any).message).toBe("Retry signal");
      }

      expect(retryCallCount).toBe(1);
    });

    it("should pass loaderOptions and retry to dependent resources", async () => {
      let capturedOptions: any = null;

      // Create parent resource that captures loader options
      const parentBuilder = createResourceBuilder({
        tags: () => ({ id: "parent-with-options" }),
        load: async ({ req, fetcher, loaderOptions }) => {
          capturedOptions = loaderOptions();

          const { load } = fetcher(createMockAdapter());
          const response = await load({
            url: `/api/parent/${(req as any).id}`,
            data: { id: (req as any).id },
          } as any);

          return { ...(response as any), type: "parent" };
        },
      });

      const parentResource = parentBuilder({ id: "parent" });

      // Create child resource that depends on parent
      const childBuilder = createResourceBuilder({
        tags: () => ({ id: "child-with-options" }),
        use: () => [parentResource],
        load: async ({ req, use, fetcher, loaderOptions }) => {
          // This should receive the same loaderOptions and retry as parent
          const config = loaderOptions();
          const parentResults = await Promise.all(use);
          const firstParent = (parentResults as any[])[0];

          const { load } = fetcher(createMockAdapter());
          const response = await load({
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
        },
        timeout: {
          delay: 3000,
          elapsedTime: 0,
          resetTimeout: () => {},
        },
        metadata: {
          contextID: createMockContextID(),
        },
      });

      const mockRetry = () => {
        throw new Error("Retry signal");
      };

      const result = await childResource.load(
        mockLoaderOptions,
        mockRetry,
        createMockContextID(),
        (fn) => fn,
      );

      // Verify both parent and child received the same loader options structure
      expect(capturedOptions.retry).toEqual({
        count: 0,
        maxCount: 2,
        resetRetryCount: expect.any(Function),
      });
      expect(capturedOptions.timeout).toEqual({
        delay: 3000,
        elapsedTime: 0,
        resetTimeout: expect.any(Function),
      });
      expect(capturedOptions.metadata).toHaveProperty("contextID");
      expect(typeof capturedOptions.metadata.contextID).toBe("object");

      expect((result as any).childLoaderConfig).toEqual({
        retry: {
          count: 0,
          maxCount: 2,
          resetRetryCount: expect.any(Function),
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
      const factory = createResourceBuilder({
        tags: () => ({ id: "no-options-test" }),
        load: async ({ req, fetcher, loaderOptions }) => {
          // loaderOptions might be undefined in some contexts
          const config = loaderOptions ? loaderOptions() : null;

          const { load } = fetcher(createMockAdapter());
          const response = await load({
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
        undefined as any,
        (): never => {
          throw new Error("retry");
        },
        createMockContextID(),
        (fn) => fn,
      );

      expect((result as any).hasLoaderOptions).toBe(false);
      expect((result as any).configSnapshot).toBe(null);
    });
  });
});
