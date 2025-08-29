import { createAspect } from "@h1y/promise-aop";

import type { LoaderCoreContext } from "../models/context";
import { LOADER_BACKOFF_ASPECT, LOADER_TIMEOUT_ASPECT } from "../models/loader";
import { TimeoutSignal } from "../signals/TimeoutSignal";
import { DynamicTimeout } from "../utils/DynamicTimeout";

export const createTimeoutAspect = <Result>() =>
  createAspect<Result, LoaderCoreContext<Result>>((createAdvice) => ({
    name: LOADER_TIMEOUT_ASPECT,

    around: createAdvice({
      use: ["__core__timeout"],
      dependsOn: [LOADER_BACKOFF_ASPECT],
      async advice({ __core__timeout: timeout }, { attachToTarget }) {
        const pending =
          timeout.pending ??
          (timeout.pending = new DynamicTimeout(
            new TimeoutSignal({ delay: timeout.delay }),
            timeout.delay,
          ));

        attachToTarget(
          (target) => async () =>
            Promise.race([target(), pending.getPromise()]),
        );
      },
    }),

    afterReturning: createAdvice({
      use: ["__core__timeout"],
      async advice({ __core__timeout: timeout }) {
        timeout.pending?.cancelTimeout();
      },
    }),

    afterThrowing: createAdvice({
      use: ["__core__timeout"],
      async advice({ __core__timeout: timeout }, error) {
        // if the error is a timeout signal, call the onTimeout callback
        if (error instanceof TimeoutSignal) {
          timeout.onTimeout?.();
        }
      },
    }),
  }));
