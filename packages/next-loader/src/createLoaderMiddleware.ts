import { middleware } from "@h1y/loader-core";

/**
 * Helper function for creating middleware that can be used with loader.
 * Generic middleware creation for data loading scenarios, supporting any data type.
 *
 * @example
 * ```typescript
 * // Create a caching middleware for data loading
 * const cachingMiddleware = createLoaderMiddleware({
 *   name: 'cache',
 *   contextGenerator: () => ({ cache: new Map() }),
 *   before: (context, input) => {
 *     const cached = context.cache.get(input);
 *     if (cached) return cached; // Skip execution, return cached result
 *   },
 *   after: (context, result, input) => {
 *     context.cache.set(input, result);
 *   },
 *   onError: (context, error, input) => {
 *     console.error(`Loading failed for ${input}:`, error);
 *   }
 * });
 *
 * // Use with loader
 * const { loader } = createLoader(dependencies, props, [cachingMiddleware]);
 * ```
 */
export const createLoaderMiddleware = middleware<unknown>;
