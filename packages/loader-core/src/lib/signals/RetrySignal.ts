import { Signal, SignalProps } from "../utils/Signal";

export class RetrySignal extends Signal {
  constructor(props: RetrySignalProps) {
    super({
      ...props,
      message: props?.message ?? MSG_RETRY_SIGNAL_DEFAULT_MESSAGE,
    });
  }
}

export interface RetrySignalProps extends SignalProps {
  message?: string;
}

export const MSG_RETRY_SIGNAL_DEFAULT_MESSAGE = "signal: retry occurred";
