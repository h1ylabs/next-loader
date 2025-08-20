import { RETRY_SIGNAL_PRIORITY } from "../models/signal";
import { Signal, SignalProps } from "../utils/Signal";

export class RetrySignal extends Signal {
  constructor(props?: SignalProps) {
    super({
      message: props?.message ?? MSG_RETRY_SIGNAL_DEFAULT_MESSAGE,
      priority: RETRY_SIGNAL_PRIORITY,
    });
  }
}

export const MSG_RETRY_SIGNAL_DEFAULT_MESSAGE =
  "loader retry attempt triggered";
