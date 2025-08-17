import { Advice } from "./advice";

export class Rejection extends Error {
  constructor(
    public readonly errors: unknown[],
    public readonly info: ErrorInfo,
  ) {
    super();
  }
}

export class HaltRejection extends Rejection {
  constructor(errors: unknown[], info: ErrorInfo) {
    super(errors, info);
  }
}

export class ContinuousRejection extends Rejection {
  constructor(errors: unknown[], info: ErrorInfo) {
    super(errors, info);
  }
}

export type ErrorInfo =
  | {
      occurredFrom: "target";
    }
  | {
      occurredFrom: "unknown";
    }
  | {
      occurredFrom: "advice";
      advice: Advice;
    };
