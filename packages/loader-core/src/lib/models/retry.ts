import { TargetWrapper } from "@h1y/promise-aop";

export type RetryContextInput<Result> = {
  readonly maxCount: number;
  readonly canRetryOnError: boolean | ((error: unknown) => boolean);
  readonly fallback?: TargetWrapper<Result>;

  readonly onRetryEach?: () => void;
  readonly onRetryExceeded?: () => void;
};

export type RetryContext<Result> = {
  readonly maxCount: number;
  readonly canRetryOnError: boolean | ((error: unknown) => boolean);

  count: number;
  resetRequested: boolean;
  fallback?: TargetWrapper<Result>;

  readonly onRetryEach?: () => void;
  readonly onRetryExceeded?: () => void;
};

export type RetryContextOptions<Result> = {
  readonly count: number;
  readonly maxCount: number;
  readonly resetRetryCount: () => void;
  readonly useFallbackOnNextRetry: (fallback: TargetWrapper<Result>) => void;
};

export function createRetryContext<Result>(
  retry: RetryContextInput<Result>,
): RetryContext<Result> {
  if (retry.maxCount < 0) {
    throw new Error(MSG_ERR_RETRY_COUNT_NEGATIVE);
  }

  if (!Number.isInteger(retry.maxCount)) {
    throw new Error(MSG_ERR_RETRY_COUNT_NON_INTEGER);
  }

  return {
    maxCount: retry.maxCount,
    canRetryOnError: retry.canRetryOnError,

    count: 0,
    resetRequested: false,

    fallback: retry.fallback,

    onRetryEach: retry.onRetryEach,
    onRetryExceeded: retry.onRetryExceeded,
  };
}

export const MSG_ERR_RETRY_COUNT_NEGATIVE =
  "retry.maxCount must be a non-negative number";
export const MSG_ERR_RETRY_COUNT_NON_INTEGER =
  "retry.maxCount must be an integer";
