import { MemoFunction } from "../utils/memoFn";

export const DEFAULT_COMPONENT_LOADER_PROPS = {
  retry: { maxCount: 0, canRetryOnError: false },
  timeout: { delay: 60000 },
} as const;

export const DEFAULT_LOADER_PROPS = {
  retry: { maxCount: 0, canRetryOnError: false },
  timeout: { delay: 60000 },
} as const;

export type LoaderDependencies = {
  readonly memo?: MemoFunction;
};
