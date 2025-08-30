import type { LoaderMiddleware } from "@h1y/loader-core";

import {
  loaderFactory as baseLoaderFactory,
  type LoaderProps,
} from "./lib/factories/loaderFactory";
import type { LoaderDependencies } from "./lib/models/loader";

export function loaderFactory<
  const Middlewares extends readonly LoaderMiddleware<
    unknown,
    unknown,
    string
  >[],
>(
  dependencies: LoaderDependencies,
  props?: LoaderProps,
  middlewares?: Middlewares,
) {
  return baseLoaderFactory({
    props,
    middlewares,
    dependencies,
  });
}
