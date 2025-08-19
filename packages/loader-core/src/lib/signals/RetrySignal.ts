import { RETRY_SIGNAL_PRIORITY } from "../models/signal";
import { Signal, SignalProps } from "../utils/Signal";

export class RetrySignal extends Signal {
  public readonly retryCount: number;

  constructor(props?: RetrySignalProps) {
    super({
      message: props?.message ?? MSG_RETRY_SIGNAL_DEFAULT_MESSAGE,
      priority: RETRY_SIGNAL_PRIORITY,
    });

    this.retryCount = props?.retryCount ?? NaN;
  }
}

export interface RetrySignalProps extends SignalProps {
  /** The number of times to retry. */
  readonly retryCount?: number;
}

export const MSG_RETRY_SIGNAL_DEFAULT_MESSAGE =
  "loader retry attempt triggered";
