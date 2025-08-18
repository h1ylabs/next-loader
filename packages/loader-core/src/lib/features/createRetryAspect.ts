import { createAspect } from "@h1y/promise-aop";

import {
  LOADER_RETRY_ASPECT,
  LOADER_TIMEOUT_ASPECT,
} from "../models/constants";
import type { LoaderCoreContext } from "../models/context";
import { RetryExceededSignal } from "../signals/RetryExceededSignal";
import { RetrySignal } from "../signals/RetrySignal";

export const createRetryAspect = <Result>() =>
  createAspect<Result, LoaderCoreContext<Result>>((createAdvice) => ({
    name: LOADER_RETRY_ASPECT,

    before: createAdvice({
      use: ["retry"],
      async advice({ retry }) {
        if (retry.count > 0) {
          retry.onRetryEach?.();
        }
      },
    }),

    around: createAdvice({
      use: ["retry"],
      dependsOn: [LOADER_TIMEOUT_ASPECT],
      async advice({ retry }, { attachToResult }) {
        if (retry.fallback) {
          attachToResult(retry.fallback);
        }
      },
    }),

    afterThrowing: createAdvice({
      use: ["retry"],
      async advice({ retry }, error) {
        const canRetry =
          // error is RetrySignal
          error instanceof RetrySignal ||
          // always retryable when true
          retry.canRetryOnError === true ||
          // delegate retry decision to the provided function
          (typeof retry.canRetryOnError === "function" &&
            retry.canRetryOnError(error));

        if (!canRetry) {
          return;
        }

        if (retry.maxCount < retry.count + 1) {
          retry.onRetryExceeded?.();
          throw new RetryExceededSignal({ maxRetry: retry.maxCount });
        }

        retry.count += 1;

        if (error instanceof RetrySignal) {
          throw error;
        }

        throw new RetrySignal({});
      },
    }),
  }));
