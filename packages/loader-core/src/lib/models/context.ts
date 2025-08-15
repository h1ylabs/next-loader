import {
  type BackoffContext,
  type BackoffContextInput,
  createBackoffContext,
} from "./backoff";
import {
  createRetryContext,
  type RetryContext,
  type RetryContextInput,
} from "./retry";
import {
  createTimeoutContext,
  type TimeoutContext,
  type TimeoutContextInput,
} from "./timeout";

export type LoaderCoreInput<Result> = {
  readonly timeout: TimeoutContextInput;
  readonly retry: RetryContextInput<Result>;
  readonly backoff?: BackoffContextInput;
};

export type LoaderCoreContext<Result> = {
  readonly timeout: TimeoutContext;
  readonly retry: RetryContext<Result>;
  readonly backoff: BackoffContext;
};

export function createLoaderCoreContext<Result>({
  retry,
  timeout,
  backoff,
}: LoaderCoreInput<Result>): LoaderCoreContext<Result> {
  return {
    timeout: createTimeoutContext(timeout),
    retry: createRetryContext(retry),
    backoff: createBackoffContext(backoff),
  };
}
