import { middleware } from "@h1y/loader-core";

export interface MockMiddlewareContext {
  calls: string[];
  data: Record<string, unknown>;
  startTime?: number;
  endTime?: number;
}

export const createMockMiddleware = (name: string) =>
  middleware<unknown>().withOptions({
    name,
    contextGenerator: (): MockMiddlewareContext => ({
      calls: [],
      data: {},
    }),
    async before(context: MockMiddlewareContext) {
      context.calls.push(`${name}:before`);
      context.startTime = Date.now();
    },
    async complete(context: MockMiddlewareContext) {
      context.calls.push(`${name}:complete`);
      context.endTime = Date.now();
    },
    async failure(context: MockMiddlewareContext, error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      context.calls.push(`${name}:failure:${errorMessage}`);
      context.data.lastError = errorMessage;
    },
  });

export const createCounterMiddleware = () =>
  middleware<unknown>().withOptions({
    name: "counter",
    contextGenerator: () => ({
      count: 0,
      executions: [] as number[],
    }),
    async before(context: { count: number; executions: number[] }) {
      context.count++;
      context.executions.push(Date.now());
    },
  });

export const createCacheMiddleware = () =>
  middleware<unknown>().withOptions({
    name: "cache",
    contextGenerator: () => ({
      cache: new Map<string, unknown>(),
      hits: 0,
      misses: 0,
    }),
    async before(context: {
      cache: Map<string, unknown>;
      hits: number;
      misses: number;
    }) {
      const key = `cache-key-${Date.now()}`;
      if (context.cache.has(key)) {
        context.hits++;
      } else {
        context.misses++;
        context.cache.set(key, { cached: true, timestamp: Date.now() });
      }
    },
  });

export const createValidationMiddleware = () =>
  middleware<unknown>().withOptions({
    name: "validation",
    contextGenerator: () => ({
      validations: [] as string[],
      isValid: true,
    }),
    async before(context: { validations: string[]; isValid: boolean }) {
      context.validations.push("validation-check");
      context.isValid = Math.random() > 0.1; // 90% success rate
    },
  });
