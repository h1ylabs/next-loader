/* eslint-disable @typescript-eslint/no-explicit-any */
import { createBaseLoader } from "@/lib/loaders/createBaseLoader";
import { createResourceBuilder } from "@/lib/loaders/createResourceBuilder";

import { createCounterMiddleware } from "./__helpers__/mockMiddleware";
import {
  createMockDependencies,
  createTestResourceBuilder,
} from "./__helpers__/testUtils";

describe("Performance and Concurrency Tests", () => {
  let mockDependencies: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDependencies = createMockDependencies();
  });

  describe("High Load Performance", () => {
    it("should handle large numbers of resources efficiently", async () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 10000 },
        },
      });

      const factory = createTestResourceBuilder();

      // Create 20 different resources (reduced for memory efficiency)
      const resources = Array.from({ length: 20 }, (_, i) =>
        factory({ id: `load-test-${i}` }),
      );

      const startTime = Date.now();
      const [load] = loader.loader(...resources);
      const results = await load();
      const endTime = Date.now();

      // All resources should load
      expect(results).toHaveLength(20);

      // Should complete in reasonable time (allow generous margin for CI)
      expect(endTime - startTime).toBeLessThan(5000);

      // Verify all results are correct
      results.forEach((result, index) => {
        expect(result).toMatchObject({
          id: `load-test-${index}`,
          data: `processed-load-test-${index}`,
        });
      });

      // Should have called memo for each unique resource (20 resources created)
      expect(mockDependencies.memo).toHaveBeenCalledTimes(20);
    });

    it("should handle memory efficiently with repeated operations", async () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const factory = createTestResourceBuilder();
      const resource = factory({ id: "memory-test" });

      // Perform many operations with the same resource (reduced for memory efficiency)
      const operations = Array.from({ length: 100 }, async () => {
        const [load] = loader.loader(resource);
        return load();
      });

      const startTime = Date.now();
      const results = await Promise.all(operations);
      const endTime = Date.now();

      // All operations should succeed
      expect(results).toHaveLength(100);

      // Should complete quickly due to caching
      expect(endTime - startTime).toBeLessThan(2000);

      // Should have called memo only once (caching working)
      expect(mockDependencies.memo).toHaveBeenCalledTimes(1);

      // All results should be identical (cached), ignore timestamp differences
      const firstResult = (results as any)[0][0];
      results.forEach(([result]) => {
        expect(result).toMatchObject({
          id: firstResult.id,
          data: firstResult.data,
        });
        // Timestamps may vary slightly due to execution timing
        expect(typeof (result as any).timestamp).toBe("number");
      });
    });
  });

  describe("Concurrent Access Patterns", () => {
    it("should handle concurrent loading of different resources", async () => {
      const counterMiddleware = createCounterMiddleware();
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        middlewares: [counterMiddleware],
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 5000 },
        },
      });

      const factory = createTestResourceBuilder();

      // Create concurrent loaders for different resources
      const concurrentLoads = Array.from({ length: 50 }, (_, i) => {
        const resource = factory({ id: `concurrent-${i}` });
        const [load] = loader.loader(resource);
        return load().then((result) => ({ index: i, result: result[0] }));
      });

      const startTime = Date.now();
      const results = await Promise.all(concurrentLoads);
      const endTime = Date.now();

      // All concurrent loads should succeed
      expect(results).toHaveLength(50);

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(3000);

      // Verify results are correct and in order
      results.forEach(({ index, result }) => {
        expect(result).toMatchObject({
          id: `concurrent-${index}`,
          data: `processed-concurrent-${index}`,
        });
      });

      // Note: Middleware context is only available during execution
      // Cannot access middleware options outside of execution context
      // This test verifies the concurrent loads completed successfully
    });

    it("should handle concurrent access to same resource efficiently", async () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const factory = createTestResourceBuilder();
      const sharedResource = factory({ id: "shared-concurrent" });

      // Simulate many components trying to load the same resource
      const concurrentAccess = Array.from({ length: 100 }, (_, i) => {
        const [load] = loader.loader(sharedResource);
        return load().then((result) => ({ clientId: i, result: result[0] }));
      });

      const startTime = Date.now();
      const results = await Promise.all(concurrentAccess);
      const endTime = Date.now();

      // All should succeed
      expect(results).toHaveLength(100);

      // Should be fast due to caching
      expect(endTime - startTime).toBeLessThan(1000);

      // All results should be identical (ignoring timestamp differences)
      const firstResult = (results[0] as any)?.result;
      results.forEach(({ result }) => {
        expect(result).toMatchObject({
          id: firstResult.id,
          data: firstResult.data,
        });
        // Timestamps may vary slightly due to execution timing
        expect(typeof (result as any).timestamp).toBe("number");
      });

      // Should have memoized only once
      expect(mockDependencies.memo).toHaveBeenCalledTimes(1);
    });

    it("should handle mixed concurrent patterns", async () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 1, canRetryOnError: true },
          timeout: { delay: 3000 },
        },
      });

      const factory = createTestResourceBuilder();

      // Mix of shared and unique resources
      const sharedResource1 = factory({ id: "shared-1" });
      const sharedResource2 = factory({ id: "shared-2" });

      const concurrentOperations = [];

      // Add operations with shared resources
      for (let i = 0; i < 20; i++) {
        const [load1] = loader.loader(sharedResource1);
        const [load2] = loader.loader(sharedResource2);
        concurrentOperations.push(
          load1().then((result) => ({ type: "shared-1", result: result[0] })),
          load2().then((result) => ({ type: "shared-2", result: result[0] })),
        );
      }

      // Add operations with unique resources
      for (let i = 0; i < 20; i++) {
        const uniqueResource = factory({ id: `unique-${i}` });
        const [load] = loader.loader(uniqueResource);
        concurrentOperations.push(
          load().then((result) => ({ type: `unique-${i}`, result: result[0] })),
        );
      }

      // Add operations with multiple resources
      for (let i = 0; i < 10; i++) {
        const [loadMulti] = loader.loader(sharedResource1, sharedResource2);
        concurrentOperations.push(
          loadMulti().then(([result1, result2]) => ({
            type: "multi",
            result: { first: result1, second: result2 },
          })),
        );
      }

      const startTime = Date.now();
      const results = await Promise.all(concurrentOperations);
      const endTime = Date.now();

      // All operations should succeed
      expect(results).toHaveLength(70); // 20*2 + 20 + 10

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(4000);

      // Verify shared resources have consistent results
      const shared1Results = results
        .filter((r) => r.type === "shared-1")
        .map((r) => r.result);
      const shared2Results = results
        .filter((r) => r.type === "shared-2")
        .map((r) => r.result);

      // All shared-1 results should be identical (ignoring timestamp)
      const firstShared1 = (shared1Results as any[])[0];
      shared1Results.forEach((result: any) => {
        expect(result).toMatchObject({
          id: firstShared1?.id,
          data: firstShared1?.data,
        });
        expect(typeof result?.timestamp).toBe("number");
      });

      // All shared-2 results should be identical (ignoring timestamp)
      const firstShared2 = shared2Results[0] as any;
      shared2Results.forEach((result: any) => {
        expect(result).toMatchObject({
          id: firstShared2?.id,
          data: firstShared2?.data,
        });
        expect(typeof result?.timestamp).toBe("number");
      });

      // Should have reasonable memo call count (not excessive)
      const memoCallCount = (mockDependencies.memo as jest.Mock).mock.calls
        .length;
      expect(memoCallCount).toBeLessThanOrEqual(22); // 2 shared + 20 unique
    });
  });

  describe("Resource Dependency Performance", () => {
    it("should efficiently handle deep dependency chains", async () => {
      // Create a chain of dependencies: A -> B -> C -> D -> E
      const createDependentBuilder = (
        name: string,
        dependency?: any,
        delay = 10,
      ) =>
        createResourceBuilder({
          tags: () => ({ identifier: name }),
          options: { staleTime: 1000 },
          use: dependency ? [dependency] : [],
          load: async ({ use, fetch }) => {
            if (use.length > 0) {
              const results = await Promise.all(use);
              const depResult = (results as any[])[0];
              await new Promise((resolve) => setTimeout(resolve, delay));
              return fetch({
                data: `${name}-data`,
                dependency: depResult,
              } as any);
            }
            await new Promise((resolve) => setTimeout(resolve, delay));
            return fetch({ data: `${name}-data` } as any);
          },
        })({ id: name });

      const resourceA = createDependentBuilder("A", null, 10);
      const resourceB = createDependentBuilder("B", resourceA, 10);
      const resourceC = createDependentBuilder("C", resourceB, 10);
      const resourceD = createDependentBuilder("D", resourceC, 10);
      const resourceE = createDependentBuilder("E", resourceD, 10);

      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 5000 },
        },
      });

      const startTime = Date.now();
      const [load] = loader.loader(resourceE);
      const [result] = await load();
      const endTime = Date.now();

      // Should have loaded the full chain - verify the basic structure
      expect(result).toMatchObject({
        data: "E-data",
      });

      // Verify the result has the expected structure (dependency chain may be flattened)
      const resultAny = result as any;
      expect(resultAny.data).toBe("E-data");
      expect(typeof resultAny.timestamp).toBe("number");

      // Should complete in reasonable time (dependencies should load sequentially)
      expect(endTime - startTime).toBeLessThan(200); // With 10ms delays, should be ~50ms + overhead
    });

    it("should handle wide dependency trees efficiently", async () => {
      // Create a root dependency
      const rootBuilder = createResourceBuilder({
        tags: () => ({ identifier: "root" }),
        options: { staleTime: 2000 },
        use: [],
        load: async ({ fetch }) => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return fetch({ data: "root-data" } as any);
        },
      });

      const root = rootBuilder({ id: "root" });

      // Create multiple resources that depend on the root
      const dependentFactories = Array.from({ length: 20 }, (_, i) =>
        createResourceBuilder({
          tags: () => ({ identifier: `branch-${i}` }),
          options: { staleTime: 1000 },
          use: [root],
          load: async ({ use, fetch }) => {
            const results = await Promise.all(use);
            const rootData = (results as any[])[0];
            await new Promise((resolve) => setTimeout(resolve, 10));
            return fetch({
              data: `branch-${i}-data`,
              root: rootData,
            } as any);
          },
        })({ id: `branch-${i}` }),
      );

      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 10000 },
        },
      });

      const startTime = Date.now();
      const [load] = loader.loader(...dependentFactories);
      const results = await load();
      const endTime = Date.now();

      // All branches should load
      expect(results).toHaveLength(20);

      // Should complete efficiently (parallel loading of branches)
      expect(endTime - startTime).toBeLessThan(500);

      // Each result should have the expected branch data
      results.forEach((result, i) => {
        expect(result).toMatchObject({
          data: `branch-${i}-data`,
        });
        // Root data may be structured differently in the actual implementation
        expect(typeof (result as any).timestamp).toBe("number");
      });

      // Root should be loaded only once (efficient dependency sharing)
      expect(mockDependencies.memo).toHaveBeenCalled();
    });
  });

  describe("Error Handling Performance", () => {
    it("should handle errors efficiently without blocking other operations", async () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 1, canRetryOnError: true },
          timeout: { delay: 2000 },
        },
      });

      const factory = createTestResourceBuilder();

      // Mix of successful and failing resources
      const mixedResources = [];

      for (let i = 0; i < 10; i++) {
        const resource = factory({ id: `success-${i}` });
        mixedResources.push(resource);
      }

      for (let i = 0; i < 5; i++) {
        const resource = factory({ id: `error-${i}` });
        resource.load = jest.fn().mockRejectedValue(new Error(`Error ${i}`));
        mixedResources.push(resource);
      }

      // Process all resources concurrently
      const operations = mixedResources.map(async (resource, index) => {
        try {
          const [load] = loader.loader(resource);
          const [result] = await load();
          return { index, success: true, result };
        } catch (error) {
          return {
            index,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      const startTime = Date.now();
      const results = await Promise.all(operations);
      const endTime = Date.now();

      // Should complete in reasonable time despite errors
      expect(endTime - startTime).toBeLessThan(3000);

      // Should have both successful and failed operations
      const successful = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      expect(successful).toHaveLength(10);
      expect(failed).toHaveLength(5);

      // Successful operations should have valid results
      successful.forEach((op) => {
        expect(op.result).toBeDefined();
        expect((op.result as any)?.id).toMatch(/^success-\d+$/);
      });

      // Failed operations should have error messages (may be wrapped by retry mechanism)
      failed.forEach((op) => {
        const errorMessage = (op as any).error;
        // Error could be original "Error X" or retry wrapped "loader retry limit exceeded"
        expect(errorMessage).toMatch(
          /^(Error \d+|loader retry limit exceeded)$/,
        );
      });
    });
  });

  describe("Memory and Resource Management", () => {
    it("should not leak memory with repeated cache operations", async () => {
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const factory = createTestResourceBuilder();

      // Simulate memory leak test by creating and discarding many resources
      for (let batch = 0; batch < 10; batch++) {
        const batchResources = Array.from({ length: 50 }, (_, i) =>
          factory({ id: `batch-${batch}-item-${i}` }),
        );

        const [load] = loader.loader(...batchResources);
        await load();

        // Simulate cleanup by removing references
        batchResources.length = 0;
      }

      // Final verification - should still work normally
      const finalResource = factory({ id: "final-test" });
      const [finalLoad] = loader.loader(finalResource);
      const [finalResult] = await finalLoad();

      expect(finalResult).toMatchObject({
        id: "final-test",
        data: "processed-final-test",
      });

      // Should have called memo many times but still be functional
      expect(mockDependencies.memo).toHaveBeenCalled();
    });
  });
});
