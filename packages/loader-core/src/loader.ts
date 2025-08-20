import {
  Aspect,
  AsyncContext,
  createProcess,
  Process,
  runProcess,
  type Target,
  TargetWrapper,
} from "@h1y/promise-aop";

import { createBackoffAspect } from "./lib/features/createBackoffAspect";
import { createRetryAspect } from "./lib/features/createRetryAspect";
import { createTimeoutAspect } from "./lib/features/createTimeoutAspect";
import {
  canPropagateRetry,
  withLoaderMetadata,
} from "./lib/features/withLoaderMetadata";
import {
  createLoaderCoreContext,
  LoaderCoreContext,
  type LoaderCoreInput,
} from "./lib/models/context";
import {
  LOADER_BACKOFF_ASPECT,
  LOADER_RETRY_ASPECT,
  LOADER_TIMEOUT_ASPECT,
  type LoaderRetryPropagation,
} from "./lib/models/loader";
import type {
  LoaderMiddleware,
  MiddlewareContext,
  MiddlewareOptions,
} from "./lib/models/middleware";
import type { LoaderCoreOptions } from "./lib/models/options";
import { ERROR_PRIORITY } from "./lib/models/signal";
import { RetrySignal } from "./lib/signals/RetrySignal";
import { generateID } from "./lib/utils/generateID";
import { Signal } from "./lib/utils/Signal";

/**
 * Creates a loader factory that provides methods to create configured loader instances.
 * The loader enhances target functions with features like retries, timeouts, custom error handling,
 * and middleware support.
 *
 * The loader is built upon an Aspect-Oriented Programming (AOP) foundation,
 * allowing for modular and reusable cross-cutting concerns.
 *
 * @example
 * ```typescript
 * // Create with custom options
 * const { execute, retry, loaderOptions } = loader<MyResult>().withOptions({
 *   input: {
 *     retry: { maxCount: 3, canRetryOnError: true },
 *     timeout: { delay: 5000 },
 *   },
 *   propagateRetry: false,
 *   middlewares: [loggingMiddleware],
 *   onDetermineError: async (errors) => errors[0],
 *   onHandleError: async (error) => defaultResult,
 * });
 *
 * // Or create with default options
 * const defaultLoader = loader<MyResult>().withDefaultOptions();
 *
 * const result = await execute(myAsyncFunction);
 * ```
 * @template Result - The expected return type of the target functions to be executed.
 * @returns An object containing `withOptions` and `withDefaultOptions` methods for creating loader instances.
 */
export function loader<const Result>() {
  const withOptions = <
    const Middlewares extends readonly LoaderMiddleware<
      Result,
      unknown,
      string
    >[],
  >({
    input,
    propagateRetry,
    middlewares,
    onDetermineError,
    onHandleError,
  }: {
    /**
     * Initial configuration for the loader's features, such as retry and timeout settings.
     */
    readonly input: LoaderCoreInput<Result>;

    /**
     * A custom function to determine which error to handle when multiple errors occur.
     * If not provided, the loader will prioritize Signal errors, or default to the first error thrown.
     * @param errors An array of errors caught during the process.
     * @returns A promise that resolves to the selected error to be handled.
     */
    readonly onDetermineError?: (errors: unknown[]) => Promise<unknown>;

    /**
     * A custom function to handle determined errors that are not Signals.
     * If not provided, the error will be re-thrown.
     * @param error The error to handle.
     * @returns A promise that resolves to a fallback value of type Result.
     */
    readonly onHandleError?: (error: unknown) => Promise<Result>;

    /**
     * Defines the retry behavior when multiple loaders are nested.
     * It can be a boolean or an object specifying propagation for parent loaders.
     */
    readonly propagateRetry: LoaderRetryPropagation;

    /**
     * An array of middlewares to be applied to the loader.
     * Each middleware can inspect, modify, or augment the loading process.
     */
    readonly middlewares: Middlewares;
  }) => {
    type LoaderContext = LoaderCoreContext<Result> &
      MiddlewareContext<Middlewares>;

    // 1. check for duplicate middleware names.
    const middlewareNames = new Set<string>([
      LOADER_BACKOFF_ASPECT,
      LOADER_RETRY_ASPECT,
      LOADER_TIMEOUT_ASPECT,
    ]);

    for (const { name } of middlewares) {
      if (middlewareNames.has(name)) {
        throw new Error(ERR_MIDDLEWARE_NAME_DUPLICATE(name));
      }

      middlewareNames.add(name);
    }

    // 2. configure the data to be used in the loader context.
    const loaderID = generateID("loader");
    const initialContext = createLoaderCoreContext(input);
    const middlewareContext = Object.fromEntries(
      middlewares.map(({ name, contextGenerator }) => [
        name,
        contextGenerator(),
      ]) ?? [],
    ) as MiddlewareContext<Middlewares>;

    const sharedContext = {
      ...initialContext,
      ...middlewareContext,
    };

    const loaderContext = AsyncContext.create<LoaderContext>(
      () => sharedContext,
    );

    // 3. configure the AOP process.
    const process: Process<Result, LoaderContext> = createProcess({
      aspects: [
        // these are the main aspects that use the loader context.
        createBackoffAspect<Result>() as Aspect<Result, LoaderContext>,
        createRetryAspect<Result>() as Aspect<Result, LoaderContext>,
        createTimeoutAspect<Result>() as Aspect<Result, LoaderContext>,

        // these are the user-defined middlewares.
        ...middlewares.map(
          ({ aspect }) => aspect as Aspect<Result, LoaderContext>,
        ),
      ],
      buildOptions: {
        advice: {
          // set the afterThrowing strategy to "HALT" to overwrite the target's error when an error is re-thrown in the advice.
          afterThrowing: {
            error: {
              runtime: {
                afterThrow: "halt",
              },
            },
          },
        },
      },
      processOptions: {
        // distinguish between signal and error to set priorities.
        async determineError({ errors }) {
          if (errors.length === 0) {
            throw new Error(ERR_NO_ERROR_TO_DETERMINE);
          }

          // find the error with the highest priority.
          // signals have a higher priority than errors.
          const [, error] = errors
            .map((error) =>
              Signal.isSignal(error)
                ? ([error.priority, error] as const)
                : ([ERROR_PRIORITY, error] as const),
            )
            .sort(([priorityA], [priorityB]) => priorityB - priorityA)
            .at(0)!;

          // if the error is a signal, return it as is.
          if (Signal.isSignal(error)) {
            return error;
          }

          // if the error is not a signal, none of the aggregated errors are signals.
          // if a user-provided function exists, call it to handle the error.
          // by default, the first error is returned.
          return onDetermineError ? onDetermineError(errors) : error;
        },

        async handleError({ exit, error, currentTarget }) {
          // non-signal errors are left for the user to handle.
          if (!Signal.isSignal(error)) {
            if (onHandleError) {
              return onHandleError(error);
            }

            throw error;
          }

          // if it's a retry signal, attempt a retry.
          if (error instanceof RetrySignal) {
            if (canPropagateRetry(loaderID, propagateRetry)) {
              throw error;
            }

            return exit(async () => {
              return runProcess({
                process,
                context: loaderContext,
                target: currentTarget,
              });
            });
          }

          throw error;
        },
      },
    });

    return {
      /**
       * Executes the target function with the loader's aspects and middlewares.
       * @param target The function to be executed by the loader.
       * @returns A promise that resolves with the result of the target function.
       */
      execute: async <T extends Result>(target: Target<T>): Promise<T> => {
        const executorFunction = async () =>
          runProcess({ process, target, context: loaderContext });

        return withLoaderMetadata(loaderID, executorFunction)() as T;
      },

      /**
       * Retrieves the context and options for the configured middlewares.
       * Can only be used from within the execution context of a target function.
       * @returns An object containing middleware-specific contexts.
       */
      middlewareOptions: (): MiddlewareOptions<Middlewares> => {
        return Object.fromEntries(
          middlewares.map(({ name }) => [
            name,
            () =>
              (loaderContext.context() as MiddlewareContext<Middlewares>)[
                name as keyof MiddlewareContext<Middlewares>
              ],
          ]) ?? [],
        ) as MiddlewareOptions<Middlewares>;
      },

      /**
       * Retrieves the current options and state of the loader.
       * Can only be used from within the execution context of a target function.
       * @returns An object containing loader-specific options and state.
       */
      loaderOptions: (): LoaderCoreOptions<Result> => {
        const { __core__retry: retry, __core__timeout: timeout } =
          loaderContext.context();

        return {
          retry: {
            count: retry.count,
            maxCount: retry.maxCount,
            resetRetryCount: () => {
              retry.count = 0;
            },
            useFallbackOnNextRetry: (fallback) => {
              retry.fallback = fallback;
            },
          },
          timeout: {
            delay: timeout.delay,
            get elapsedTime() {
              const pending = timeout.pending;
              return pending ? Date.now() - pending.getStartTime() : 0;
            },
            resetTimeout: () => {
              timeout.pending?.resetTimeout();
            },
          },
        };
      },

      /**
       * Manually triggers a retry of the target function.
       * This function will throw a `RetrySignal` to be caught by the loader's retry mechanism.
       * Can only be used from within the execution context of a target function.
       * @param fallback An optional function to be used for the subsequent retry instead of the original target.
       */
      retry: (fallback?: TargetWrapper<Result>): never => {
        if (fallback) {
          loaderContext.context().__core__retry.fallback = fallback;
        }

        throw new RetrySignal();
      },
    } as const;
  };

  /**
   * Creates a loader instance with default configuration settings.
   * This provides a minimal loader with no retries, no timeout limits, no middlewares,
   * and no retry propagation - essentially a pass-through wrapper for the target function.
   *
   * Default settings:
   * - Retry: disabled (maxCount: 0, canRetryOnError: false)
   * - Timeout: unlimited (delay: Infinity)
   * - Middlewares: none
   * - Retry propagation: disabled
   *
   * @returns A basic loader instance with default configuration.
   */
  const withDefaultOptions = () =>
    withOptions({
      input: {
        retry: { maxCount: 0, canRetryOnError: false },
        timeout: { delay: Infinity },
      },
      middlewares: [],
      propagateRetry: false,
    });

  return { withOptions, withDefaultOptions } as const;
}

export const ERR_MIDDLEWARE_NAME_DUPLICATE = (name: string) =>
  `there is duplicate middleware name: ${name}`;
export const ERR_NO_ERROR_TO_DETERMINE = "no error to determine";
