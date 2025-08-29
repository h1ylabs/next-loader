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

  // retry fallback with priority
  readonly fallback: {
    // 1st priority: directly specified fallback
    immediate?: TargetWrapper<Result>;

    // 2nd priority: conditional fallback
    conditional?: TargetWrapper<Result>;

    // condition match information defined within the component
    matchers: {
      readonly when: (error: unknown) => boolean;
      readonly fallback: (error: unknown) => TargetWrapper<Result>;
    }[];

    // 3rd priority: fallback specified in initial settings
    readonly initial?: TargetWrapper<Result>;

    // internally determined fallback
    target?: TargetWrapper<Result>;
  };

  readonly onRetryEach?: () => void;
  readonly onRetryExceeded?: () => void;
};

export type RetryContextOptions = {
  readonly count: number;
  readonly maxCount: number;
  readonly resetRetryCount: () => void;
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

    fallback: {
      initial: retry.fallback,
      matchers: [],
    },

    onRetryEach: retry.onRetryEach,
    onRetryExceeded: retry.onRetryExceeded,
  };
}

export const MSG_ERR_RETRY_COUNT_NEGATIVE =
  "retry.maxCount must be a non-negative number";
export const MSG_ERR_RETRY_COUNT_NON_INTEGER =
  "retry.maxCount must be an integer";
