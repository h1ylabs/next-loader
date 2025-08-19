import { Signal, SignalProps } from "@/lib/utils/Signal";

import { RETRY_EXCEEDED_SIGNAL_PRIORITY } from "../models/signal";

export class RetryExceededSignal extends Signal {
  public readonly maxRetry: number;

  constructor(props?: RetryExceededSignalProps) {
    super({
      message: props?.message ?? MSG_RETRY_EXCEEDED_SIGNAL_DEFAULT_MESSAGE,
      priority: RETRY_EXCEEDED_SIGNAL_PRIORITY,
    });

    this.maxRetry = props?.maxRetry ?? NaN;
  }
}

export interface RetryExceededSignalProps extends SignalProps {
  /** The maximum number of times to retry. */
  readonly maxRetry?: number;
}

export const MSG_RETRY_EXCEEDED_SIGNAL_DEFAULT_MESSAGE =
  "loader retry limit exceeded";
