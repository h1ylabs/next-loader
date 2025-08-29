import type { LoaderMiddleware } from "@h1y/loader-core";

import {
  createBaseLoader,
  type LoaderProps,
} from "./lib/loaders/createBaseLoader";
import type { LoaderDependencies } from "./lib/models/loader";

export function createLoader<
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
  return createBaseLoader({
    props,
    middlewares,
    dependencies,
  });
}
