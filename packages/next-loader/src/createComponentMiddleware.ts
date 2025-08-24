import { middleware } from "@h1y/loader-core";

/**
 * Helper function for creating middleware that can be used with componentLoader.
 * Specialized for React.ReactElement type, providing type-safe middleware creation for component loading scenarios.
 *
 * @example
 * ```typescript
 * // Create a metrics middleware for component loading
 * const metricsMiddleware = createComponentMiddleware({
 *   name: 'metrics',
 *   contextGenerator: () => ({ startTime: Date.now() }),
 *   before: (context) => {
 *     console.log('Component loading started');
 *   },
 *   after: (context, result) => {
 *     console.log(`Component loaded in ${Date.now() - context.startTime}ms`);
 *   },
 *   onError: (context, error) => {
 *     console.error('Component loading failed:', error);
 *   }
 * });
 *
 * // Use with componentLoader
 * const { componentLoader } = createComponentLoader(props, [metricsMiddleware]);
 * ```
 */
export const createComponentMiddleware = middleware<React.ReactElement>;
