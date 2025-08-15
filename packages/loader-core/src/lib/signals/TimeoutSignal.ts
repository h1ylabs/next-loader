import { Signal, SignalProps } from "@/lib/utils/Signal";

export class TimeoutSignal extends Signal {
  public readonly delay?: number;

  constructor(props: TimeoutSignalProps) {
    super({
      message: props.message ?? MSG_TIMEOUT_SIGNAL_DEFAULT_MESSAGE,
    });

    this.delay = props.delay;
  }
}

export interface TimeoutSignalProps extends SignalProps {
  /**
   * The delay in milliseconds before the timeout occurs.
   */
  delay: number;
}

export const MSG_TIMEOUT_SIGNAL_DEFAULT_MESSAGE = "timeout occurred";
