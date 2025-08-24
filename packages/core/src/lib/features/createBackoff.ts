import { Backoff } from "../models/backoff";

export const FIXED_BACKOFF = createBackoff("fixed", (delay) => delay);
export const LINEAR_BACKOFF = (add: number) =>
  createBackoff("linear", (delay) => delay + add);
export const EXPONENTIAL_BACKOFF = (factor: number) =>
  createBackoff("exponential", (delay) => delay * factor);

export function createBackoff<T extends string>(
  type: T,
  next: Backoff<T>["next"],
): Backoff<T> {
  return {
    type,
    next(delay) {
      const result = next(delay);

      if (delay < 0 || result < 0) {
        throw new Error(MSG_ERR_BACKOFF_RESOLVER_DELAY_NEGATIVE);
      }

      return result;
    },
  };
}

export const MSG_ERR_BACKOFF_RESOLVER_DELAY_NEGATIVE =
  "delay must be non-negative";
