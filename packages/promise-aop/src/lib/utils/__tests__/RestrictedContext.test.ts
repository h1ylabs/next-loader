/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  MSG_ERR_RESTRICTED_CONTEXT_NOT_ALLOWED_SECTION,
  MSG_ERR_RESTRICTED_CONTEXT_SECTION_IN_USE,
  MSG_ERR_RESTRICTED_CONTEXT_SECTION_IN_USE_BY_OTHER,
  RestrictedContext,
} from "@/lib/utils/RestrictedContext";

describe("RestrictedContext", () => {
  interface AdviceContext {
    database: { query: string };
    cache: { key: string };
    network: { url: string };
    config: { retries: number };
  }

  let adviceContext: AdviceContext;
  let restrictedContext: RestrictedContext<AdviceContext>;

  beforeEach(() => {
    adviceContext = {
      database: { query: "SELECT * FROM users" },
      cache: { key: "user:123" },
      network: { url: "https://api.example.com" },
      config: { retries: 3 },
    };
    restrictedContext = new RestrictedContext(adviceContext);
  });

  describe("basic section access", () => {
    it("should allow access to granted sections", async () => {
      const result = await restrictedContext.use(
        async (context) => {
          expect(context.database.query).toBe("SELECT * FROM users");
          expect(context.cache.key).toBe("user:123");
          return "advice executed";
        },
        ["database", "cache"] as const,
      );

      expect(result).toBe("advice executed");
    });

    it("should allow single section access", async () => {
      await restrictedContext.use(
        async (context) => {
          expect(context.network.url).toBe("https://api.example.com");
        },
        ["network"] as const,
      );
    });

    it("should handle empty sections array", async () => {
      const result = await restrictedContext.use(
        async () => "no sections needed",
        [],
      );

      expect(result).toBe("no sections needed");
    });
  });

  describe("unauthorized section access", () => {
    it("should throw error when accessing non-granted section", async () => {
      await restrictedContext.use(
        async (context) => {
          expect(() => (context as any).config).toThrow(
            MSG_ERR_RESTRICTED_CONTEXT_NOT_ALLOWED_SECTION("config"),
          );
        },
        ["database"] as const,
      );
    });

    it("should distinguish between unauthorized and in-use errors", async () => {
      const longRunningPromise = restrictedContext.use(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
        },
        ["database"] as const,
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      await restrictedContext.use(
        async (context) => {
          // cache is not granted and not in use - unauthorized error
          expect(() => (context as any).cache).toThrow(
            MSG_ERR_RESTRICTED_CONTEXT_NOT_ALLOWED_SECTION("cache"),
          );

          // database is in use by another operation - in-use error
          expect(() => (context as any).database).toThrow(
            MSG_ERR_RESTRICTED_CONTEXT_SECTION_IN_USE_BY_OTHER("database"),
          );
        },
        ["network"] as const,
      );

      await longRunningPromise;
    });
  });

  describe("section conflict detection", () => {
    it("should detect section conflicts in concurrent usage", async () => {
      const promise1 = restrictedContext.use(
        async (context) => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return context.database.query;
        },
        ["database"] as const,
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      await expect(
        restrictedContext.use(async () => "should fail", ["database"] as const),
      ).rejects.toThrow(MSG_ERR_RESTRICTED_CONTEXT_SECTION_IN_USE("database"));

      await promise1;
    });

    it("should handle multiple section conflicts", async () => {
      const promise = restrictedContext.use(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
        },
        ["database", "cache"] as const,
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      await expect(
        restrictedContext.use(async () => "should fail", [
          "database",
          "network",
        ] as const),
      ).rejects.toThrow(MSG_ERR_RESTRICTED_CONTEXT_SECTION_IN_USE("database"));

      await promise;
    });

    it("should allow access after section is released", async () => {
      await restrictedContext.use(
        async (context) => {
          expect(context.database.query).toBe("SELECT * FROM users");
        },
        ["database"] as const,
      );

      await restrictedContext.use(
        async (context) => {
          expect(context.database.query).toBe("SELECT * FROM users");
        },
        ["database"] as const,
      );
    });
  });

  describe("concurrent operations", () => {
    it("should allow concurrent access to different sections", async () => {
      const results = await Promise.all([
        restrictedContext.use(
          async (context) => {
            await new Promise((resolve) => setTimeout(resolve, 30));
            return context.database.query;
          },
          ["database"] as const,
        ),
        restrictedContext.use(
          async (context) => {
            await new Promise((resolve) => setTimeout(resolve, 20));
            return context.cache.key;
          },
          ["cache"] as const,
        ),
        restrictedContext.use(
          async (context) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return context.network.url;
          },
          ["network"] as const,
        ),
      ]);

      expect(results).toEqual([
        "SELECT * FROM users",
        "user:123",
        "https://api.example.com",
      ]);
    });

    it("should handle sequential operations on same section", async () => {
      const results = [];

      for (let i = 0; i < 3; i++) {
        const result = await restrictedContext.use(
          async (context) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return `advice-${i}-${context.config.retries}`;
          },
          ["config"] as const,
        );
        results.push(result);
      }

      expect(results).toEqual(["advice-0-3", "advice-1-3", "advice-2-3"]);
    });
  });

  describe("error handling and cleanup", () => {
    it("should release sections after advice throws error", async () => {
      const adviceError = new Error("advice failed");

      await expect(
        restrictedContext.use(
          async () => {
            throw adviceError;
          },
          ["database"] as const,
        ),
      ).rejects.toThrow(adviceError);

      // Section should be available again after error
      await restrictedContext.use(
        async (context) => {
          expect(context.database.query).toBe("SELECT * FROM users");
        },
        ["database"] as const,
      );
    });

    it("should release sections after async advice throws error", async () => {
      const asyncError = new Error("async advice failed");

      await expect(
        restrictedContext.use(
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            throw asyncError;
          },
          ["cache"] as const,
        ),
      ).rejects.toThrow(asyncError);

      await restrictedContext.use(
        async (context) => {
          expect(context.cache.key).toBe("user:123");
        },
        ["cache"] as const,
      );
    });

    it("should handle section conflicts during error scenarios", async () => {
      const longRunningPromise = restrictedContext.use(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          throw new Error("long running advice error");
        },
        ["network"] as const,
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      await expect(
        restrictedContext.use(async () => "should not succeed", [
          "network",
        ] as const),
      ).rejects.toThrow(MSG_ERR_RESTRICTED_CONTEXT_SECTION_IN_USE("network"));

      await expect(longRunningPromise).rejects.toThrow(
        "long running advice error",
      );

      // Now section should be available
      await restrictedContext.use(
        async (context) => {
          expect(context.network.url).toBe("https://api.example.com");
        },
        ["network"] as const,
      );
    });
  });

  describe("edge cases", () => {
    it("should handle promise rejection in advice", async () => {
      const rejectionError = new Error("promise rejection");

      await expect(
        restrictedContext.use(async () => Promise.reject(rejectionError), [
          "config",
        ] as const),
      ).rejects.toThrow(rejectionError);

      // Section should be released after error
      await restrictedContext.use(
        async (context) => {
          expect(context.config.retries).toBe(3);
        },
        ["config"] as const,
      );
    });
  });
});
