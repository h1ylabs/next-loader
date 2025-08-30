import type { RetryContextOptions } from "./retry";
import type { TimeoutContextOptions } from "./timeout";

export interface LoaderCoreOptions {
  readonly timeout: TimeoutContextOptions;
  readonly retry: RetryContextOptions;
}
