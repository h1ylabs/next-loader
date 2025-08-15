import { Signal, SignalProps } from "@/lib/utils/Signal";

export class RetryExceededSignal extends Signal {
  public readonly maxRetry: number;

  constructor(props: RetryExceededSignalProps) {
    super({
      ...props,
      message: props?.message ?? MSG_RETRY_EXCEEDED_SIGNAL_DEFAULT_MESSAGE,
    });

    this.maxRetry = props.maxRetry;
  }
}

export interface RetryExceededSignalProps extends SignalProps {
  maxRetry: number;
}

export const MSG_RETRY_EXCEEDED_SIGNAL_DEFAULT_MESSAGE =
  "signal: retry exceeded";
