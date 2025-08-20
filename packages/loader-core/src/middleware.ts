/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAspect } from "@h1y/promise-aop";

import { MiddlewareInvalidContextSignal } from "@/lib/signals/MiddlewareInvalidContextSignal";

import type { LoaderMiddleware } from "./lib/models/middleware";

/**
 * Creates a middleware factory that provides methods to create configured middleware instances.
 * Middlewares are built on top of the promise-aop library and act as aspects
 * that can run code before, after, or on failure of the target function.
 *
 * @example
 * ```typescript
 * const loggingMiddleware = middleware<MyResult>().withOptions({
 *   name: 'logging',
 *   contextGenerator: () => ({ startTime: 0 }),
 *   before: async (context) => {
 *     context.startTime = Date.now();
 *     console.log('Loader execution started.');
 *   },
 *   complete: async (context, result) => {
 *     const duration = Date.now() - context.startTime;
 *     console.log(`Loader execution finished in ${duration}ms. Result:`, result);
 *   },
 *   failure: async (context, error) => {
 *     console.error('Loader execution failed:', error);
 *   }
 * });
 * ```
 *
 * @template Result - The expected return type of the target functions to be executed.
 * @returns An object containing `withOptions` method for creating middleware instances.
 */
export function middleware<const Result>() {
  const withOptions = <Context, MiddlewareName extends string>({
    name,
    contextGenerator,
    before,
    cleanup,
    complete,
    failure,
  }: {
    /**
     * The unique name of the middleware. This is used to identify the middleware's context.
     */
    name: MiddlewareName;

    /**
     * A function that generates the initial context for the middleware.
     * This context is private to the middleware and can be used to store state across lifecycle hooks.
     * @returns The initial context.
     */
    contextGenerator: () => Context;

    /**
     * An advice function that runs before the target function is executed.
     * @param context The middleware's private context.
     */
    before?: (context: Context) => Promise<void>;

    /**
     * An advice function that runs after the target function successfully completes.
     * @param context The middleware's private context.
     * @param result The result returned by the target function.
     */
    complete?: (context: Context, result: Result) => Promise<void>;

    /**
     * An advice function that runs after any of the advices or the target function throws an error.
     * @param context The middleware's private context.
     */
    cleanup?: (context: Context) => Promise<void>;

    /**
     * An advice function that runs when an error is thrown during the execution.
     * @param context The middleware's private context.
     * @param error The error that was thrown.
     */
    failure?: (context: Context, error: unknown) => Promise<void>;
  }): LoaderMiddleware<Result, Context, MiddlewareName> => {
    return {
      name,
      contextGenerator,
      aspect: createAspect((createAdvice) => ({
        name,
        before: before
          ? createAdvice({
              // the SectionsUsed type specified in 'use' only accepts literal (constant) strings.
              // therefore, creating advice that receives a specific string type is not allowed by the typescript system,
              // so we are forced to use 'any'.
              use: [name] as any,
              async advice({ [name]: context }) {
                if (context === undefined) {
                  throw new MiddlewareInvalidContextSignal({
                    middlewareName: name,
                  });
                }

                // same applies to context.
                await before(context as Context);
              },
            })
          : undefined,
        afterReturning: complete
          ? createAdvice({
              use: [name] as any,
              async advice({ [name]: context }, result) {
                if (context === undefined) {
                  throw new MiddlewareInvalidContextSignal({
                    middlewareName: name,
                  });
                }

                await complete(context as Context, result as Result);
              },
            })
          : undefined,
        afterThrowing: failure
          ? createAdvice({
              use: [name] as any,
              async advice({ [name]: context }, error) {
                if (context === undefined) {
                  throw new MiddlewareInvalidContextSignal({
                    middlewareName: name,
                  });
                }

                await failure(context as Context, error);
              },
            })
          : undefined,
        after: cleanup
          ? createAdvice({
              use: [name] as any,
              async advice({ [name]: context }) {
                if (context === undefined) {
                  throw new MiddlewareInvalidContextSignal({
                    middlewareName: name,
                  });
                }

                await cleanup(context as Context);
              },
            })
          : undefined,
      })),
    };
  };

  return { withOptions } as const;
}
