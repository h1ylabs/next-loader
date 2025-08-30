export const DEFAULT_COMPONENT_LOADER_PROPS = {
  retry: { maxCount: 0, canRetryOnError: false },
  timeout: { delay: 60000 },
} as const;

export const DEFAULT_LOADER_PROPS = {
  retry: { maxCount: 0, canRetryOnError: false },
  timeout: { delay: 60000 },
} as const;

export type LoaderDependencies = {
  /* eslint-disable @typescript-eslint/no-unsafe-function-type */
  readonly lifeCycleCache: <Fn extends Function>(fn: Fn) => Fn;
};

export type LoaderID = {
  readonly __loaderID: unique symbol;
};
