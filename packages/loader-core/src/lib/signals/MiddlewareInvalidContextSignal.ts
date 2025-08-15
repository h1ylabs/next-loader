import { Signal, SignalProps } from "../utils/Signal";

export class MiddlewareInvalidContextSignal extends Signal {
  public readonly middlewareName: string;
  constructor(props: MiddlewareInvalidContextSignalProps) {
    super({
      ...props,
      message:
        props?.message ?? MSG_MIDDLEWARE_INVALID_CONTEXT_SIGNAL_DEFAULT_MESSAGE,
    });

    this.middlewareName = props.middlewareName;
  }
}

export interface MiddlewareInvalidContextSignalProps extends SignalProps {
  middlewareName: string;
}

export const MSG_MIDDLEWARE_INVALID_CONTEXT_SIGNAL_DEFAULT_MESSAGE =
  "signal: middleware invalid context";
