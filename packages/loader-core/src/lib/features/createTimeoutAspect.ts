import { createAspect } from "@h1y/promise-aop";

import {
  LOADER_BACKOFF_ASPECT,
  LOADER_TIMEOUT_ASPECT,
} from "../models/constants";
import type { LoaderCoreContext } from "../models/context";
import { TimeoutSignal } from "../signals/TimeoutSignal";
import { DynamicTimeout } from "../utils/DynamicTimeout";

export const createTimeoutAspect = <Result>() =>
  createAspect<Result, LoaderCoreContext<Result>>((createAdvice) => ({
    name: LOADER_TIMEOUT_ASPECT,

    around: createAdvice({
      use: ["timeout"],
      dependsOn: [LOADER_BACKOFF_ASPECT],
      async advice({ timeout }, { attachToTarget }) {
        if (timeout.pending) {
          return;
        }

        const pending = (timeout.pending = new DynamicTimeout(
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
      use: ["timeout"],
      async advice({ timeout }) {
        timeout.pending?.cancelTimeout();
      },
    }),

    afterThrowing: createAdvice({
      use: ["timeout"],
      async advice({ timeout }, error) {
        // if the error is a timeout signal, call the onTimeout callback
        if (error instanceof TimeoutSignal) {
          timeout.onTimeout?.();
        }
      },
    }),
  }));
