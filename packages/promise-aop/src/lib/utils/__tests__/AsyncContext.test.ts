import {
  AsyncContext,
  MSG_ERR_ASYNC_CONTEXT_GENERATOR_NOT_PROVIDED,
  MSG_ERR_ASYNC_CONTEXT_NOT_EXIST,
} from "@/lib/utils/AsyncContext";

interface TestContext {
  id: string;
  data: number;
}

interface ComplexTestContext {
  userId: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

describe("AsyncContext", () => {
  describe("Static Method Execution", () => {
    it("should execute operation with contextGenerator from instance", async () => {
      const contextGenerator = (): TestContext => ({ id: "test-1", data: 42 });
      const asyncCtx = AsyncContext.create(contextGenerator);

      const result = await AsyncContext.execute(asyncCtx, async (context) => {
        const ctx = context();
        expect(ctx.id).toBe("test-1");
        expect(ctx.data).toBe(42);
        return ctx.data * 2;
      });

      expect(result).toBe(84);
    });

    it("should execute operation with external contextGenerator using executeWith", async () => {
      const asyncCtx = AsyncContext.create<TestContext>();
      const contextGenerator = (): TestContext => ({
        id: "external",
        data: 100,
      });

      const result = await AsyncContext.executeWith(
        asyncCtx,
        contextGenerator,
        async (context) => {
          const ctx = context();
          expect(ctx.id).toBe("external");
          expect(ctx.data).toBe(100);
          return ctx.id;
        },
      );

      expect(result).toBe("external");
    });

    it("should provide context access within nested async operations", async () => {
      const contextGenerator = (): TestContext => ({ id: "nested", data: 25 });
      const asyncCtx = AsyncContext.create(contextGenerator);

      await AsyncContext.execute(asyncCtx, async (context) => {
        const outerCtx = context();
        expect(outerCtx.id).toBe("nested");

        await new Promise((resolve) => setTimeout(resolve, 10));

        const innerCtx = context();
        expect(innerCtx.id).toBe("nested");
        expect(innerCtx.data).toBe(25);
      });
    });
  });

  describe("Error Handling", () => {
    it("should throw error when execute is called without contextGenerator", async () => {
      const asyncCtx = AsyncContext.create<TestContext>();

      await expect(
        AsyncContext.execute(asyncCtx, async (context) => {
          return context();
        }),
      ).rejects.toThrow(MSG_ERR_ASYNC_CONTEXT_GENERATOR_NOT_PROVIDED);
    });

    it("should throw error when context is accessed outside execution scope", async () => {
      const contextGenerator = (): TestContext => ({ id: "test", data: 1 });
      const asyncCtx = AsyncContext.create(contextGenerator);
      let contextFn: () => TestContext;

      await AsyncContext.execute(asyncCtx, async (context) => {
        contextFn = context;
        const ctx = context();
        expect(ctx.id).toBe("test");
      });

      expect(() => contextFn()).toThrow(MSG_ERR_ASYNC_CONTEXT_NOT_EXIST);
      // Also validate instance-level global accessor throws outside execution
      expect(() => asyncCtx.context()).toThrow(MSG_ERR_ASYNC_CONTEXT_NOT_EXIST);
    });
  });

  describe("Async Context Isolation", () => {
    it("should maintain separate contexts in parallel executions", async () => {
      const asyncCtx = AsyncContext.create<TestContext>();

      const results = await Promise.all([
        AsyncContext.executeWith(
          asyncCtx,
          () => ({ id: "parallel-1", data: 10 }),
          async (context) => {
            await new Promise((resolve) => setTimeout(resolve, 20));
            return context();
          },
        ),
        AsyncContext.executeWith(
          asyncCtx,
          () => ({ id: "parallel-2", data: 20 }),
          async (context) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return context();
          },
        ),
        AsyncContext.executeWith(
          asyncCtx,
          () => ({ id: "parallel-3", data: 30 }),
          async (context) => {
            await new Promise((resolve) => setTimeout(resolve, 15));
            return context();
          },
        ),
      ]);

      expect(results[0].id).toBe("parallel-1");
      expect(results[0].data).toBe(10);
      expect(results[1].id).toBe("parallel-2");
      expect(results[1].data).toBe(20);
      expect(results[2].id).toBe("parallel-3");
      expect(results[2].data).toBe(30);
    });

    it("should preserve context through Promise chains", async () => {
      const contextGenerator = (): TestContext => ({ id: "chain", data: 5 });
      const asyncCtx = AsyncContext.create(contextGenerator);

      const result = await AsyncContext.execute(asyncCtx, async (context) => {
        return Promise.resolve(context().data)
          .then((data) => data * 2)
          .then(async (data) => {
            const ctx = context();
            return { originalId: ctx.id, multipliedData: data };
          });
      });

      expect(result.originalId).toBe("chain");
      expect(result.multipliedData).toBe(10);
    });
  });

  describe("Context Data Flow", () => {
    it("should handle complex context data types", async () => {
      const contextGenerator = (): ComplexTestContext => ({
        userId: "user-123",
        timestamp: Date.now(),
        metadata: { role: "admin", permissions: ["read", "write"] },
      });

      const asyncCtx = AsyncContext.create(contextGenerator);

      await AsyncContext.execute(asyncCtx, async (context) => {
        const ctx = context();
        expect(ctx.userId).toBe("user-123");
        expect(typeof ctx.timestamp).toBe("number");
        expect(ctx.metadata.role).toBe("admin");
        expect(ctx.metadata.permissions).toEqual(["read", "write"]);
      });
    });

    it("should handle primitive context data", async () => {
      const stringCtx = AsyncContext.create(() => "simple-string");
      const numberCtx = AsyncContext.create(() => 42);
      const booleanCtx = AsyncContext.create(() => true);

      await AsyncContext.execute(stringCtx, async (context) => {
        expect(context()).toBe("simple-string");
      });

      await AsyncContext.execute(numberCtx, async (context) => {
        expect(context()).toBe(42);
      });

      await AsyncContext.execute(booleanCtx, async (context) => {
        expect(context()).toBe(true);
      });
    });

    it("should generate fresh context data for each execution", async () => {
      let counter = 0;
      const contextGenerator = (): TestContext => ({
        id: `instance-${++counter}`,
        data: counter * 10,
      });

      const asyncCtx = AsyncContext.create(contextGenerator);

      const result1 = await AsyncContext.execute(asyncCtx, async (context) =>
        context(),
      );
      const result2 = await AsyncContext.execute(asyncCtx, async (context) =>
        context(),
      );

      expect(result1.id).toBe("instance-1");
      expect(result1.data).toBe(10);
      expect(result2.id).toBe("instance-2");
      expect(result2.data).toBe(20);
    });
  });

  describe("Global access via instance.context()", () => {
    it("should allow accessing context via instance inside execution", async () => {
      const contextGenerator = (): TestContext => ({ id: "global-1", data: 7 });
      const ac = AsyncContext.create(contextGenerator);

      await AsyncContext.execute(ac, async (getCtx) => {
        const fromParam = getCtx();
        const fromInstance = ac.context();

        expect(fromInstance).toBe(fromParam);
        expect(fromInstance.id).toBe("global-1");
        expect(fromInstance.data).toBe(7);
      });
    });

    it("should isolate contexts across parallel executions using instance accessor", async () => {
      const ac = AsyncContext.create<TestContext>();

      const [a, b] = await Promise.all([
        AsyncContext.executeWith(
          ac,
          () => ({ id: "g-parallel-1", data: 1 }),
          async () => ac.context(),
        ),
        AsyncContext.executeWith(
          ac,
          () => ({ id: "g-parallel-2", data: 2 }),
          async () => ac.context(),
        ),
      ]);

      expect(a.id).toBe("g-parallel-1");
      expect(a.data).toBe(1);
      expect(b.id).toBe("g-parallel-2");
      expect(b.data).toBe(2);
    });

    it("should work with executeWith and instance accessor", async () => {
      const ac = AsyncContext.create<TestContext>();

      const result = await AsyncContext.executeWith(
        ac,
        () => ({ id: "with-instance", data: 123 }),
        async () => {
          const ctx = ac.context();
          return `${ctx.id}:${ctx.data}`;
        },
      );

      expect(result).toBe("with-instance:123");
    });

    it("should support external helper accessing instance context within execution", async () => {
      const ac = AsyncContext.create(
        (): TestContext => ({ id: "ext", data: 9 }),
      );

      // Simulates an external helper that doesn't receive context param
      const externalHelper = () => {
        const { id, data } = ac.context();
        return `${id}:${data}`;
      };

      const output = await AsyncContext.execute(ac, async () =>
        externalHelper(),
      );
      expect(output).toBe("ext:9");
    });
  });
});
