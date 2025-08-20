// priority of signals (higher priority means higher priority)
// 1. MiddlewareInvalidContextSignal
// 2. TimeoutSignal
// 3. RetryExceededSignal
// 4. RetrySignal (always retryable)
// 5. Error (retryable)
export const MIDDLEWARE_INVALID_SIGNAL_PRIORITY = 0b1000_0000_0000_0000; /* prettier-ignore */
export const TIMEOUT_SIGNAL_PRIORITY =            0b0100_0000_0000_0000; /* prettier-ignore */
export const RETRY_EXCEEDED_SIGNAL_PRIORITY =     0b0010_0000_0000_0000; /* prettier-ignore */
export const RETRY_SIGNAL_PRIORITY =              0b0001_0000_0000_0000; /* prettier-ignore */
export const ANY_SIGNAL_PRIORITY =                0b0000_0000_0000_0001; /* prettier-ignore */
export const ERROR_PRIORITY =                     0b0000_0000_0000_0000; /* prettier-ignore */
