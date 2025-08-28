import {
  Aspect,
  AsyncContext,
  createProcess,
  Process,
  runProcess,
  runProcessWith,
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
import { type LoaderRetryPropagation } from "./lib/models/loader";
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
    readonly input: LoaderCoreInput<Result>;
    readonly onDetermineError?: (errors: unknown[]) => Promise<unknown>;
    readonly onHandleError?: (error: unknown) => Promise<Result>;
    readonly propagateRetry: LoaderRetryPropagation;
    readonly middlewares: Middlewares;
  }) => {
    type LoaderContext = LoaderCoreContext<Result> &
      MiddlewareContext<Middlewares>;

    // 1. check for duplicate middleware names.
    const middlewareNames = new Set<string>([
      "__core__backoff",
      "__core__metadata",
      "__core__retry",
      "__core__timeout",
    ] satisfies (keyof LoaderCoreContext<Result>)[]);

    for (const { name } of middlewares) {
      if (middlewareNames.has(name)) {
        throw new Error(ERR_MIDDLEWARE_NAME_DUPLICATE(name));
      }

      middlewareNames.add(name);
    }

    // 2. configure the data to be used in the loader context.
    const loaderID = generateID("loader");
    const createContext = () => ({
      ...createLoaderCoreContext(input),
      ...(Object.fromEntries(
        middlewares.map(({ name, contextGenerator }) => [
          name,
          contextGenerator(),
        ]) ?? [],
      ) as MiddlewareContext<Middlewares>),
    });

    const loaderContext = AsyncContext.create<LoaderContext>(createContext);

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

        async handleError({ exit, error, currentTarget, context }) {
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
              throw new RetrySignal({ ...error, propagated: true });
            }

            const nextContext = context();

            return exit(async () => {
              return runProcessWith({
                process,
                context: loaderContext,
                contextGenerator: () => nextContext,
                target: currentTarget,
              });
            });
          }

          throw error;
        },
      },
    });

    return {
      execute: async <T extends Result>(target: Target<T>): Promise<T> => {
        const executorFunction = async () =>
          runProcess({ process, target, context: loaderContext });

        return withLoaderMetadata(loaderID, executorFunction)() as T;
      },

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

      loaderOptions: (): LoaderCoreOptions => {
        const {
          __core__retry: retry,
          __core__timeout: timeout,
          __core__metadata: metadata,
        } = loaderContext.context();

        return {
          retry: {
            count: retry.count,
            maxCount: retry.maxCount,
            resetRetryCount: () => {
              retry.count = 0;
            },
          },
          metadata: {
            ...metadata,
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

      retryImmediately: (fallback?: TargetWrapper<Result>): never => {
        // 수동적으로 재시도를 수행하는 경우, 최우선으로 폴백이 적용됩니다.
        if (fallback) {
          loaderContext.context().__core__retry.fallback.immediate = fallback;
        }

        throw new RetrySignal();
      },

      retryFallback: <T>(matcher: {
        readonly when: (error: T) => boolean;
        readonly fallback: (error: T) => TargetWrapper<Result>;
      }) => {
        loaderContext.context().__core__retry.fallback.matchers.push(
          matcher as {
            readonly when: (error: unknown) => boolean;
            readonly fallback: (error: unknown) => TargetWrapper<Result>;
          },
        );
      },
    } as const;
  };

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
