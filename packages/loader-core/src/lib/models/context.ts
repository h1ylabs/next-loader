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
  readonly __core__timeout: TimeoutContext;
  readonly __core__retry: RetryContext<Result>;
  readonly __core__backoff: BackoffContext;
};

export function createLoaderCoreContext<Result>({
  retry,
  timeout,
  backoff,
}: LoaderCoreInput<Result>): LoaderCoreContext<Result> {
  return {
    __core__timeout: createTimeoutContext(timeout),
    __core__retry: createRetryContext(retry),
    __core__backoff: createBackoffContext(backoff),
  };
}
