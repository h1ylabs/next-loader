/* eslint-disable @typescript-eslint/no-explicit-any */
import { FIXED_BACKOFF } from "@/lib/features/createBackoff";

import { loader, middleware } from "../index";

interface ApiResponse<T = any> {
  status: number;
  data: T;
  headers: Record<string, string>;
  timestamp: number;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  preferences: Record<string, any>;
}

describe("Real-World Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe("Basic API Integration", () => {
    it("should handle basic API call with retry", async () => {
      const { execute } = loader().withOptions({
        input: {
          retry: { maxCount: 3, canRetryOnError: true },
          timeout: { delay: 5000 },
          backoff: { strategy: FIXED_BACKOFF, initialDelay: 100 },
        },
        propagateRetry: false,
        middlewares: [],
      });

      let apiCallCount = 0;
      const mockApiCall = jest.fn(
        async (): Promise<ApiResponse<UserProfile>> => {
          apiCallCount++;

          if (apiCallCount === 1) {
            throw new Error("HTTP 500: Internal server error");
          }

          return {
            status: 200,
            data: {
              id: "user-123",
              name: "John Doe",
              email: "john@example.com",
              preferences: { theme: "dark" },
            },
            headers: { "content-type": "application/json" },
            timestamp: Date.now(),
          };
        },
      );

      const result = (await execute(mockApiCall)) as ApiResponse<UserProfile>;

      expect(result.status).toBe(200);
      expect(result.data.name).toBe("John Doe");
      expect(apiCallCount).toBe(2);
    });

    it("should handle metrics middleware", async () => {
      const metricsMiddleware = middleware().withOptions({
        name: "metrics",
        contextGenerator: () => ({
          requestCount: 0,
          errors: 0,
        }),
        before: async (context) => {
          context.requestCount++;
        },
        failure: async (context) => {
          context.errors++;
        },
      });

      const { execute, middlewareOptions } = loader().withOptions({
        input: {
          retry: { maxCount: 2, canRetryOnError: true },
          timeout: { delay: 5000 },
        },
        propagateRetry: false,
        middlewares: [metricsMiddleware],
      });

      let capturedMetrics: any;
      const apiCall = jest.fn(async () => {
        // Access middleware options within execution context
        capturedMetrics = middlewareOptions().metrics();
        return { success: true } as const;
      });

      const result = await execute(apiCall);

      expect(result.success).toBe(true);
      expect(capturedMetrics.requestCount).toBe(1);
      expect(capturedMetrics.errors).toBe(0);
    });
  });

  describe("Basic Database Operations", () => {
    it("should handle simple retry scenario", async () => {
      let globalAttempts = 0;

      const { execute } = loader().withOptions({
        input: {
          retry: { maxCount: 3, canRetryOnError: true },
          timeout: { delay: 5000 },
          backoff: { strategy: FIXED_BACKOFF, initialDelay: 50 },
        },
        propagateRetry: false,
        middlewares: [],
      });

      const simpleOperation = jest.fn(async () => {
        globalAttempts++;

        if (globalAttempts === 1) {
          throw new Error("Database connection failed");
        }

        return {
          success: true,
          attempt: globalAttempts,
        };
      });

      const result = (await execute(simpleOperation)) as {
        success: boolean;
        attempt: number;
      };

      expect(result.success).toBe(true);
      expect(result.attempt).toBe(2);
      expect(globalAttempts).toBe(2);
    });
  });
});
