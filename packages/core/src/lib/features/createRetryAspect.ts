import { createAspect } from "@h1y/promise-aop";

import type { LoaderCoreContext } from "../models/context";
import { LOADER_RETRY_ASPECT, LOADER_TIMEOUT_ASPECT } from "../models/loader";
import { RetryExceededSignal } from "../signals/RetryExceededSignal";
import { RetrySignal } from "../signals/RetrySignal";
import { Signal } from "../utils/Signal";

export const createRetryAspect = <Result>() =>
  createAspect<Result, LoaderCoreContext<Result>>((createAdvice) => ({
    name: LOADER_RETRY_ASPECT,

    before: createAdvice({
      use: ["__core__retry"],
      async advice({ __core__retry: retry }) {
        // execute retry event handler
        if (retry.count > 0) {
          retry.onRetryEach?.();
        }

        // determine the fallback to execute next
        retry.fallback.target =
          /* 1st priority */ retry.fallback.immediate ??
          /* 2nd priority */ retry.fallback.conditional ??
          /* 3rd priority */ retry.fallback.initial;

        // clean up fallback information from previous context (excluding initial settings)
        retry.fallback.matchers = [];
        retry.fallback.immediate = undefined;
        retry.fallback.conditional = undefined;
      },
    }),

    around: createAdvice({
      use: ["__core__retry"],
      dependsOn: [LOADER_TIMEOUT_ASPECT],
      async advice({ __core__retry: retry }, { attachToResult }) {
        if (retry.count > 0 && retry.fallback.target) {
          attachToResult(retry.fallback.target);
        }
      },
    }),

    afterThrowing: createAdvice({
      use: ["__core__retry"],
      async advice({ __core__retry: retry }, error) {
        // signals that are not retry signals are excluded from retries.
        if (Signal.isSignal(error) && !(error instanceof RetrySignal)) {
          return;
        }

        // error is not a signal, check if the error is retryable.
        if (!Signal.isSignal(error)) {
          const { canRetryOnError } = retry;

          const isRetryable =
            // always retryable when true
            canRetryOnError === true ||
            // delegate retry decision to the provided function
            (typeof canRetryOnError === "function" && canRetryOnError(error));

          if (!isRetryable) {
            return;
          }
        }

        // check if the retry count is exceeded.
        if (retry.maxCount < retry.count + 1) {
          retry.onRetryExceeded?.();
          throw new RetryExceededSignal({ maxRetry: retry.maxCount });
        }

        // increment retry count by 1
        retry.count += 1;

        // select fallback registered in retryFallback
        const errorTarget =
          error instanceof RetrySignal ? error.errorReason : error;

        retry.fallback.conditional = retry.fallback.matchers
          .find(({ when }) => when(errorTarget))
          ?.fallback(errorTarget);

        // propagate retry signal
        if (error instanceof RetrySignal) {
          throw new RetrySignal({ ...error });
        }

        throw new RetrySignal({ errorReason: error });
      },
    }),
  }));
