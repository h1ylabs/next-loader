import { RETRY_SIGNAL_PRIORITY } from "../models/signal";
import { Signal, SignalProps } from "../utils/Signal";

export class RetrySignal extends Signal {
  public readonly errorReason: unknown;
  public readonly propagated: boolean;

  constructor(props?: RetrySignalProps) {
    super({
      message: props?.message ?? MSG_RETRY_SIGNAL_DEFAULT_MESSAGE,
      priority: RETRY_SIGNAL_PRIORITY,
    });

    this.errorReason = props?.errorReason;
    this.propagated = props?.propagated ?? false;
  }
}

export interface RetrySignalProps extends SignalProps {
  errorReason?: unknown;
  propagated?: boolean;
}

export const MSG_RETRY_SIGNAL_DEFAULT_MESSAGE =
  "loader retry attempt triggered";
