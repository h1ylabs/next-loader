import { DynamicTimeout } from "@/lib/utils/DynamicTimeout";

export type TimeoutContextInput = {
  /** Specifies the delay time until timeout in milliseconds. */
  readonly delay: number;
  /** Called when timeout occurs. */
  readonly onTimeout?: () => void;
};

export type TimeoutContext = {
  readonly delay: number;
  readonly onTimeout?: () => void;
  pending?: DynamicTimeout;
};

export type TimeoutContextOptions = {
  readonly delay: number;
  readonly elapsedTime: number;
  readonly resetTimeout: () => void;
};

export function createTimeoutContext(
  timeout: TimeoutContextInput,
): TimeoutContext {
  if (timeout.delay < 0) {
    throw new Error(MSG_ERR_TIMEOUT_DELAY_NEGATIVE);
  }

  if (!Number.isFinite(timeout.delay)) {
    throw new Error(MSG_ERR_TIMEOUT_DELAY_INFINITE);
  }

  return { ...timeout };
}

export const MSG_ERR_TIMEOUT_DELAY_NEGATIVE =
  "timeout.delay must be a non-negative number";
export const MSG_ERR_TIMEOUT_DELAY_INFINITE =
  "timeout.delay must be a finite number";
