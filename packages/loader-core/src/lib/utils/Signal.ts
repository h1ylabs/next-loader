import { ANY_SIGNAL_PRIORITY } from "../models/signal";

export class Signal extends Error {
  public readonly priority: number;

  constructor(props?: SignalProps) {
    super(props?.message ?? MSG_SIGNAL_DEFAULT_MESSAGE);

    this.priority = props?.priority ?? ANY_SIGNAL_PRIORITY;
    this.name = "Signal";
  }

  static isSignal(error: unknown): error is Signal {
    return error instanceof Signal;
  }
}

export interface SignalProps {
  readonly message?: string;
  readonly priority?: number;
}

export const MSG_SIGNAL_DEFAULT_MESSAGE = "loader signal triggered";
