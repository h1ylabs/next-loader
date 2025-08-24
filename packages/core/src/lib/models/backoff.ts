export type BackoffContextInput = {
  readonly strategy: Backoff;
  readonly initialDelay: number;
};

export type BackoffContext = {
  readonly strategy: Backoff | null;
  nextDelay: number;
};

export type Backoff<T extends string = string> = {
  type: T;
  next: (delay: number) => number;
};

export function createBackoffContext(
  backoff?: BackoffContextInput,
): BackoffContext {
  if (backoff?.initialDelay && backoff.initialDelay < 0) {
    throw new Error(MSG_ERR_BACKOFF_INITIAL_DELAY_NEGATIVE);
  }

  return {
    strategy: backoff?.strategy ?? null,
    nextDelay: backoff?.initialDelay ?? 0,
  };
}

export const MSG_ERR_BACKOFF_INITIAL_DELAY_NEGATIVE =
  "initial backoff delay must be non-negative";
