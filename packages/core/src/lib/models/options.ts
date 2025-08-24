import type { RetryContextOptions } from "./retry";
import type { TimeoutContextOptions } from "./timeout";

export interface LoaderCoreOptions<Result> {
  readonly timeout: TimeoutContextOptions;
  readonly retry: RetryContextOptions<Result>;
}
