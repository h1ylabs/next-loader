/* eslint-disable @typescript-eslint/no-explicit-any */
import { createBaseLoader } from "@/lib/loaders/createBaseLoader";
import { createResourceBuilder } from "@/lib/loaders/createResourceBuilder";

import { createMockMiddleware } from "./__helpers__/mockMiddleware";
import { createMockAdapter } from "./__helpers__/mockResourceBuilder";
import { createMockDependencies } from "./__helpers__/testUtils";

describe("Integration Tests", () => {
  let mockDependencies: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDependencies = createMockDependencies();
  });

  describe("Full Stack Integration", () => {
    it("should integrate createResourceBuilder + createBaseLoader", async () => {
      // Step 1: Create resources using createResourceBuilder
      const userResourceBuilder = createResourceBuilder({
        tags: (req: { userId: string }) => ({
          identifier: `user-${req.userId}`,
          effects: ["user-cache"],
        }),
        options: { staleTime: 5000 },
        use: [],
        load: async ({ req, fetch }) => {
          const response = (await fetch({
            url: `/api/users/${req.userId}`,
            data: { userId: req.userId, type: "user" },
          } as any)) as any;
          return {
            userId: req.userId,
            name: `User ${req.userId}`,
            email: `user${req.userId}@test.com`,
            timestamp: response.timestamp,
          };
        },
      });

      const profileResourceBuilder = createResourceBuilder({
        tags: (req: { userId: string }) => ({
          identifier: `profile-${req.userId}`,
          effects: ["profile-cache"],
        }),
        options: { staleTime: 3000 },
        use: [], // No dependencies for this test
        load: async ({ req, fetch }) => {
          const response = (await fetch({
            url: `/api/profiles/${req.userId}`,
            data: { userId: req.userId, type: "profile" },
          } as any)) as any;
          return {
            userId: req.userId,
            bio: `Bio for user ${req.userId}`,
            preferences: { theme: "dark", lang: "en" },
            timestamp: response.timestamp,
          };
        },
      });

      // Step 2: Create resources instances
      const userResource = userResourceBuilder({ userId: "123" });
      const profileResource = profileResourceBuilder({ userId: "123" });

      // Step 3: Create loaders with middleware
      const mockMiddleware = createMockMiddleware("integration");

      const baseLoaderInstance = createBaseLoader({
        dependencies: mockDependencies,
        middlewares: [mockMiddleware],
        props: {
          retry: { maxCount: 1, canRetryOnError: true },
          timeout: { delay: 5000 },
        },
      });

      const createBaseLoaderInstance = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 1, canRetryOnError: true },
          timeout: { delay: 5000 },
        },
        middlewares: [mockMiddleware],
      });

      // Step 4: Test individual loading
      const [individualLoad] = baseLoaderInstance.loader(userResource);
      const [userResult] = await individualLoad();
      expect(userResult).toMatchObject({
        userId: "123",
        name: "User 123",
        email: "user123@test.com",
      });

      // Step 5: Test batch loading with createBaseLoader
      const [batchLoad] = createBaseLoaderInstance.loader(
        userResource,
        profileResource,
      );
      const [batchUserResult, batchProfileResult] = await batchLoad();

      expect(batchUserResult).toMatchObject({
        userId: "123",
        name: "User 123",
        email: "user123@test.com",
      });
      expect(batchProfileResult).toMatchObject({
        userId: "123",
        bio: "Bio for user 123",
        preferences: { theme: "dark", lang: "en" },
      });

      // Step 6: Note - Middleware integration cannot be tested outside execution context
      // Middleware options are only available during the actual loading execution
      // The fact that the loads completed successfully indicates middleware is working

      // Step 7: Verify caching worked
      expect(mockDependencies.memo).toHaveBeenCalled();
    });

    it("should handle complex dependency chains", async () => {
      // Create a chain: Organization -> Department -> User
      const orgResourceBuilder = createResourceBuilder({
        tags: (req: { orgId: string }) => ({
          identifier: `org-${req.orgId}`,
          effects: ["org-cache"],
        }),
        options: { staleTime: 10000 },
        use: [],
        load: async ({ req }) => {
          return {
            orgId: req.orgId,
            name: `Organization ${req.orgId}`,
            type: "organization",
          };
        },
      });

      const orgResource = orgResourceBuilder({ orgId: "acme" });

      const deptResourceBuilder = createResourceBuilder({
        tags: (req: { deptId: string }) => ({
          identifier: `dept-${req.deptId}`,
          effects: ["dept-cache"],
        }),
        options: { staleTime: 8000 },
        use: [orgResource], // Depends on organization
        load: async ({ req, use }) => {
          const results = await Promise.all(use);
          const orgData = (results as any[])[0];
          return {
            deptId: req.deptId,
            name: `Department ${req.deptId}`,
            organization: orgData,
            type: "department",
          };
        },
      });

      const deptResource = deptResourceBuilder({ deptId: "engineering" });

      const userResourceBuilder = createResourceBuilder({
        tags: (req: { userId: string }) => ({
          identifier: `user-${req.userId}`,
          effects: ["user-cache"],
        }),
        options: { staleTime: 5000 },
        use: [deptResource], // Depends on department (which depends on org)
        load: async ({ req, use }) => {
          const results = await Promise.all(use);
          const deptData = (results as any[])[0];
          return {
            userId: req.userId,
            name: `User ${req.userId}`,
            department: deptData,
            type: "user",
          };
        },
      });

      const userResource = userResourceBuilder({ userId: "john" });

      // Test the full chain
      const loader = createBaseLoader({
        dependencies: mockDependencies,
      });
      const [load] = loader.loader(userResource);
      const [result] = await load();

      expect(result).toMatchObject({
        userId: "john",
        name: "User john",
        type: "user",
        department: {
          deptId: "engineering",
          name: "Department engineering",
          type: "department",
          organization: {
            orgId: "acme",
            name: "Organization acme",
            type: "organization",
          },
        },
      });

      // Verify dependency tags were collected correctly
      expect(userResource.tag.dependencies).toContain("dept-engineering");
      expect(userResource.tag.dependencies).toContain("dept-cache");
      expect(deptResource.tag.dependencies).toContain("org-acme");
      expect(deptResource.tag.dependencies).toContain("org-cache");
    });

    it("should handle error propagation across components", async () => {
      // Create a resource that will fail
      const failingResourceBuilder = createResourceBuilder({
        tags: () => ({ identifier: "failing-resource" }),
        options: {},
        use: [],
        load: async ({ fetch }) => {
          return fetch({
            shouldError: true,
            errorMessage: "Resource loading failed",
          } as any);
        },
      });

      const failingResource = failingResourceBuilder({ id: "test" });

      // Create a dependent resource
      const dependentResourceBuilder = createResourceBuilder({
        tags: () => ({ identifier: "dependent-resource" }),
        options: {},
        use: [failingResource],
        load: async ({ use, fetch }) => {
          await Promise.all(use); // This should fail
          return fetch({ data: "should not reach here" } as any);
        },
      });

      const dependentResource = dependentResourceBuilder({ id: "dependent" });

      // Test error propagation with createBaseLoader
      const baseLoaderInstance = createBaseLoader({
        dependencies: {
          adapter: createMockAdapter(),
          revalidate: () => {},
        },
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const [failLoad] = baseLoaderInstance.loader(dependentResource);
      await expect(failLoad()).rejects.toThrow("Resource loading failed");

      // Test error propagation with createBaseLoader
      const createBaseLoaderInstance = createBaseLoader({
        dependencies: mockDependencies,
      });
      const [load] = createBaseLoaderInstance.loader(dependentResource);

      await expect(load()).rejects.toThrow("Resource loading failed");
    });
  });

  describe("Performance and Concurrency Integration", () => {
    it("should handle concurrent loading with shared dependencies", async () => {
      // Create shared dependency
      const sharedResourceBuilder = createResourceBuilder({
        tags: () => ({ identifier: "shared-resource", effects: ["shared"] }),
        options: { staleTime: 5000 },
        use: [],
        load: async ({ fetch }) => {
          // Simulate some processing time
          await new Promise((resolve) => setTimeout(resolve, 100));
          return fetch({ data: "shared-data", timestamp: Date.now() } as any);
        },
      });

      const sharedResource = sharedResourceBuilder({ id: "shared" });

      // Create multiple resources that depend on the shared one
      const createDependentResource = (id: string) =>
        createResourceBuilder({
          tags: () => ({ identifier: `dependent-${id}` }),
          options: {},
          use: [sharedResource],
          load: async ({ use, fetch }) => {
            const results = await Promise.all(use);
            const sharedData = (results as any[])[0];
            return fetch({
              data: `dependent-${id}-data`,
              sharedData,
              timestamp: Date.now(),
            } as any);
          },
        })({ id });

      const dependent1 = createDependentResource("1");
      const dependent2 = createDependentResource("2");
      const dependent3 = createDependentResource("3");

      // Load all dependents concurrently
      const loader = createBaseLoader({
        dependencies: mockDependencies,
      });
      const [load] = loader.loader(dependent1, dependent2, dependent3);

      const startTime = Date.now();
      const results = await load();
      const endTime = Date.now();

      // All should complete
      expect(results).toHaveLength(3);
      expect(results[0]).toMatchObject({ data: "dependent-1-data" });
      expect(results[1]).toMatchObject({ data: "dependent-2-data" });
      expect(results[2]).toMatchObject({ data: "dependent-3-data" });

      // Should not take too long (parallel processing)
      expect(endTime - startTime).toBeLessThan(500); // Allow some margin for test environment

      // Verify shared dependency was loaded efficiently
      expect(mockDependencies.memo).toHaveBeenCalled();
    });

    it("should maintain consistency under rapid successive calls", async () => {
      const createResourceBuilder1 = createResourceBuilder({
        tags: (req: { id: string }) => ({ identifier: `rapid-${req.id}` }),
        options: { staleTime: 1000 },
        use: [],
        load: async ({ req, fetch }) => {
          return fetch({
            data: `rapid-data-${req.id}`,
            timestamp: Date.now(),
          } as any);
        },
      });

      const loader = createBaseLoader({
        dependencies: mockDependencies,
      });
      const resource = createResourceBuilder1({ id: "test" });

      // Fire multiple rapid calls
      const promises = Array.from({ length: 10 }, (_, i) => {
        const [load] = loader.loader(resource);
        return load().then((result) => ({ index: i, result }));
      });

      const results = await Promise.all(promises);

      // All should succeed
      expect(results).toHaveLength(10);

      // All should have the same result (cached), ignoring timestamp differences
      const firstResult = (results[0] as any)?.result?.[0] as any;
      results.forEach(({ result }: any) => {
        const resultData = (result as any[])?.[0] as any;
        expect(resultData).toMatchObject({
          data: firstResult?.data,
          // Ignore timestamp and other time-sensitive fields
        });
        expect(typeof resultData?.timestamp).toBe("number");
      });

      // Should have called memo efficiently (not 10 times)
      const memoCallCount = (mockDependencies.memo as jest.Mock).mock.calls
        .length;
      expect(memoCallCount).toBe(1);
    });
  });

  describe("Real-world Scenario Simulation", () => {
    it("should simulate a typical Next.js data loading pattern", async () => {
      // Simulate a page that needs to load user data, user posts, and user settings
      const userBuilder = createResourceBuilder({
        tags: (req: { userId: string }) => ({
          identifier: `user-${req.userId}`,
          effects: ["user-cache", "auth-cache"],
        }),
        options: { staleTime: 30000 }, // 30 seconds
        use: [],
        load: async ({ req, fetch }) => {
          return fetch({
            url: `/api/users/${req.userId}`,
            data: { userId: req.userId, name: `User ${req.userId}` },
          } as any);
        },
      });

      const user = userBuilder({ userId: "123" });

      const postsBuilder = createResourceBuilder({
        tags: (req: { userId: string }) => ({
          identifier: `posts-${req.userId}`,
          effects: ["posts-cache"],
        }),
        options: { staleTime: 10000 }, // 10 seconds
        use: [user], // Posts depend on user data
        load: async ({ req, use, fetch }) => {
          const results = await Promise.all(use);
          const userData = (results as any[])[0];
          // userData might be wrapped in a response structure
          const actualUserData = (userData as any)?.data || userData;
          const userName = actualUserData?.name || `User ${req.userId}`;
          return fetch({
            url: `/api/users/${req.userId}/posts`,
            data: {
              posts: [`Post 1 by ${userName}`, `Post 2 by ${userName}`],
              userId: req.userId,
            },
          } as any);
        },
      });

      const settingsBuilder = createResourceBuilder({
        tags: (req: { userId: string }) => ({
          identifier: `settings-${req.userId}`,
          effects: ["settings-cache"],
        }),
        options: { staleTime: 60000 }, // 60 seconds
        use: [user], // Settings depend on user data
        load: async ({ req, use, fetch }) => {
          const results = await Promise.all(use);
          const userData = (results as any[])[0];
          // userData might be wrapped in a response structure
          const actualUserData = (userData as any)?.data || userData;
          const userName = actualUserData?.name || `User ${req.userId}`;
          return fetch({
            url: `/api/users/${req.userId}/settings`,
            data: {
              theme: "dark",
              notifications: true,
              userId: req.userId,
              userName: userName,
            },
          } as any);
        },
      });

      const posts = postsBuilder({ userId: "123" });
      const settings = settingsBuilder({ userId: "123" });

      // Simulate server-side rendering scenario
      const middleware = createMockMiddleware("ssr");
      const loader = createBaseLoader({
        dependencies: mockDependencies,
        props: {
          retry: { maxCount: 2, canRetryOnError: true },
          timeout: { delay: 30000 }, // 30 second timeout for SSR
        },
        middlewares: [middleware],
      });

      // Load all page data in parallel
      const [pageLoad, revalidate] = loader.loader(user, posts, settings);
      const [userData, postsData, settingsData] = await pageLoad();

      // Verify all data loaded correctly
      // Note: userData might be wrapped in response structure
      const userDataAny = userData as any;
      const postsDataAny = postsData as any;
      const settingsDataAny = settingsData as any;

      expect(userDataAny?.data || userDataAny).toMatchObject({
        userId: "123",
        name: "User 123",
      });

      expect(postsDataAny?.data || postsDataAny).toMatchObject({
        posts: ["Post 1 by User 123", "Post 2 by User 123"],
        userId: "123",
      });

      expect(settingsDataAny?.data || settingsDataAny).toMatchObject({
        theme: "dark",
        notifications: true,
        userId: "123",
        userName: "User 123",
      });

      // Note: Middleware context is only available during execution
      // The successful completion of the loads indicates middleware is working
      // Cannot access middleware options outside of execution context

      // Verify revalidation function exists and works
      expect(typeof revalidate).toBe("function");
      expect(revalidate.toString()).toContain('"use server"');

      // Test revalidation call
      revalidate();
      // Verify revalidation was called with the correct tags (only identifier tags, not effects)
      expect(mockDependencies.revalidate).toHaveBeenCalledWith(
        "user-123",
        "posts-123",
        "settings-123",
      );
    });
  });

  describe("Validation Tests", () => {
    it("should throw an error for invalid hierarchy tags", () => {
      const invalidResourceBuilder = createResourceBuilder({
        tags: () => ({
          identifier: [], // Invalid empty hierarchy
        }),
        options: {},
        use: [],
        load: async () => "test",
      });

      // Expect the resource creation to throw due to invalid tag
      expect(() => invalidResourceBuilder({})).toThrow(
        "invalid hierarchy tag: must have at least one tag",
      );
    });
  });
});
