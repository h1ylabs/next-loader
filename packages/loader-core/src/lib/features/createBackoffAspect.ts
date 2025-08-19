import { createAspect } from "@h1y/promise-aop";

import type { LoaderCoreContext } from "../models/context";
import { LOADER_BACKOFF_ASPECT } from "../models/loader";

async function waitFor(timeMs: number) {
  return new Promise((resolve) => setTimeout(resolve, timeMs));
}

export const createBackoffAspect = <Result>() =>
  createAspect<Result, LoaderCoreContext<Result>>((createAdvice) => ({
    name: LOADER_BACKOFF_ASPECT,

    around: createAdvice({
      use: ["__core__backoff"],
      async advice({ __core__backoff: backoff }, { attachToTarget }) {
        // if no strategy, do nothing
        if (backoff.strategy === null) {
          return;
        }

        const delay = backoff.nextDelay;
        backoff.nextDelay = backoff.strategy.next(delay);

        // attach backoff to target
        attachToTarget((target) => async () => waitFor(delay).then(target));
      },
    }),
  }));
