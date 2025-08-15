import { createAspect } from "@h1y/promise-aop";

import { LOADER_BACKOFF_ASPECT } from "../models/constants";
import type { LoaderCoreContext } from "../models/context";

async function waitFor(timeMs: number) {
  return new Promise((resolve) => setTimeout(resolve, timeMs));
}

export const createBackoffAspect = <Result>() =>
  createAspect<Result, LoaderCoreContext<Result>>((createAdvice) => ({
    name: LOADER_BACKOFF_ASPECT,

    around: createAdvice({
      use: ["backoff"],
      async advice({ backoff }, { attachToTarget }) {
        // if no strategy, do nothing
        if (backoff.strategy === null) {
          return;
        }

        const delay = backoff.nextDelay;
        backoff.nextDelay = backoff.strategy.next(delay);

        // target에 backoff를 부여한다.
        attachToTarget((target) => async () => waitFor(delay).then(target));
      },
    }),
  }));
