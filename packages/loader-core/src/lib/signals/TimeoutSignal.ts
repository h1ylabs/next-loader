import { Signal, SignalProps } from "@/lib/utils/Signal";

import { TIMEOUT_SIGNAL_PRIORITY } from "../models/signal";

export class TimeoutSignal extends Signal {
  public readonly delay: number;

  constructor(props?: TimeoutSignalProps) {
    super({
      message: props?.message ?? MSG_TIMEOUT_SIGNAL_DEFAULT_MESSAGE,
      priority: TIMEOUT_SIGNAL_PRIORITY,
    });

    this.delay = props?.delay ?? NaN;
  }
}

export interface TimeoutSignalProps extends SignalProps {
  /** The delay in milliseconds before the timeout occurs. */
  readonly delay?: number;
}

export const MSG_TIMEOUT_SIGNAL_DEFAULT_MESSAGE = "loader operation timed out";
