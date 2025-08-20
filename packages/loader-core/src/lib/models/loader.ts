import { AsyncContext } from "@h1y/promise-aop";

// boolean: always propagate, or not
// HAS_OUTER_CONTEXT: propagate if there is an outer context, or not
// HAS_SAME_OUTER_CONTEXT: propagate if there is the same outer context, or not
export type LoaderRetryPropagation =
  | boolean
  | "HAS_OUTER_CONTEXT"
  | "HAS_SAME_OUTER_CONTEXT";

export type LoaderMetadata = { hierarchy: string[] };
export const LoaderMetadata = AsyncContext.create<LoaderMetadata>(() => ({
  hierarchy: [],
}));

export const LOADER_BACKOFF_ASPECT = "LOADER_BACKOFF_ASPECT";
export const LOADER_RETRY_ASPECT = "LOADER_RETRY_ASPECT";
export const LOADER_TIMEOUT_ASPECT = "LOADER_TIMEOUT_ASPECT";
