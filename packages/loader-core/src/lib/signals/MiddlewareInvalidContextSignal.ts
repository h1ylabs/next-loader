import { MIDDLEWARE_INVALID_SIGNAL_PRIORITY } from "../models/signal";
import { Signal, SignalProps } from "../utils/Signal";

export class MiddlewareInvalidContextSignal extends Signal {
  public readonly middlewareName: string;

  constructor(props?: MiddlewareInvalidContextSignalProps) {
    super({
      message:
        props?.message ?? MSG_MIDDLEWARE_INVALID_CONTEXT_SIGNAL_DEFAULT_MESSAGE,
      priority: MIDDLEWARE_INVALID_SIGNAL_PRIORITY,
    });

    this.middlewareName = props?.middlewareName ?? "";
  }
}

export interface MiddlewareInvalidContextSignalProps extends SignalProps {
  /** The name of the middleware that failed to validate the context. */
  readonly middlewareName?: string;
}

export const MSG_MIDDLEWARE_INVALID_CONTEXT_SIGNAL_DEFAULT_MESSAGE =
  "loader middleware context is invalid";
