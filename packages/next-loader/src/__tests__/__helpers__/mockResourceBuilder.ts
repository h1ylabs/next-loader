import type {
  ExternalResourceAdapter,
  ExternalResourceOptions,
} from "@/lib/models/resourceAdapter";

export interface MockLoaderParam {
  url?: string;
  data?: unknown;
  delay?: number;
  shouldError?: boolean;
  errorMessage?: string;
}

export interface MockLoaderResponse {
  data: unknown;
  tags: readonly string[];
  options: ExternalResourceOptions;
  timestamp: number;
}

// Global call tracking for mock adapter
const mockAdapterCallTracker = new Map<string, number>();

export const getMockAdapterCallCount = (key?: string) => {
  if (key) {
    return mockAdapterCallTracker.get(key) ?? 0;
  }
  return Array.from(mockAdapterCallTracker.values()).reduce(
    (sum, count) => sum + count,
    0,
  );
};

export const resetMockAdapterCallTracker = () => {
  mockAdapterCallTracker.clear();
};

export const createMockAdapter = (): ExternalResourceAdapter<
  MockLoaderParam,
  MockLoaderResponse
> => {
  return ({ tags, options }) => ({
    load: async (param: MockLoaderParam) => {
      // Track adapter calls for testing
      const trackingKey =
        typeof param === "object" && param.url ? param.url : "default";
      mockAdapterCallTracker.set(
        trackingKey,
        (mockAdapterCallTracker.get(trackingKey) ?? 0) + 1,
      );

      if (param.shouldError) {
        throw new Error(param.errorMessage || "Mock loader error");
      }

      if (param.delay) {
        await new Promise((resolve) => setTimeout(resolve, param.delay));
      }

      return {
        data: param.data || `mock-data-${Date.now()}`,
        tags,
        options,
        timestamp: Date.now(),
      };
    },
  });
};

// Backward compatibility
export const createMockLoaderBuilder = createMockAdapter;

export const createSimpleAdapter = (): ExternalResourceAdapter<
  string,
  string
> => {
  return ({ tags, options }) => ({
    load: async (param: string) => {
      return `response:${param}:${JSON.stringify({ tags, options })}`;
    },
  });
};

// Backward compatibility
export const createSimpleLoaderBuilder = createSimpleAdapter;
