import { TargetWrapper } from "@h1y/promise-aop";

import { Signal, SignalProps } from "../utils/Signal";

export class RetrySignal<Result> extends Signal {
  public readonly fallback?: TargetWrapper<Result>;

  constructor(props: RetrySignalProps<Result>) {
    super({
      ...props,
      message: props?.message ?? MSG_RETRY_SIGNAL_DEFAULT_MESSAGE,
    });

    this.fallback = props.fallback;
  }
}

export interface RetrySignalProps<Result> extends SignalProps {
  fallback?: TargetWrapper<Result>;
  message?: string;
}

export const MSG_RETRY_SIGNAL_DEFAULT_MESSAGE = "signal: retry occurred";
