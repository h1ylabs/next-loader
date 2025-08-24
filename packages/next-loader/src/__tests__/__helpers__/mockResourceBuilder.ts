import type {
  ResourceAdapter,
  ResourceOptions,
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
  options: ResourceOptions;
  timestamp: number;
}

export const createMockAdapter = (): ResourceAdapter<
  MockLoaderParam,
  MockLoaderResponse
> => {
  return ({ tags, options }) =>
    async (param) => {
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
    };
};

// Backward compatibility
export const createMockLoaderBuilder = createMockAdapter;

export const createSimpleAdapter = (): ResourceAdapter<string, string> => {
  return ({ tags, options }) =>
    async (param) => {
      return `response:${param}:${JSON.stringify({ tags, options })}`;
    };
};

// Backward compatibility
export const createSimpleLoaderBuilder = createSimpleAdapter;
