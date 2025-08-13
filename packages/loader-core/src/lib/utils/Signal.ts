export class Signal extends Error {
  constructor(props?: SignalProps) {
    super(props?.message ?? MSG_SIGNAL_DEFAULT_MESSAGE);
  }

  static isSignal(error: unknown): error is Signal {
    return error instanceof Signal;
  }
}

export interface SignalProps {
  /** Optional custom message for the signal */
  message?: string;
}

export const MSG_SIGNAL_DEFAULT_MESSAGE = "signal occurred";
