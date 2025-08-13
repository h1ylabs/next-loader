import { Advice } from "./advice";

export class Rejection extends Error {
  constructor(public readonly info: RejectionInfo) {
    super();
  }
}

export class HaltRejection extends Rejection {
  constructor(info: RejectionInfo) {
    super(info);
  }
}

export class ContinuousRejection extends Rejection {
  constructor(info: RejectionInfo) {
    super(info);
  }
}

export type RejectionInfo = {
  error: unknown;
  extraInfo:
    | {
        // error occurred in target
        type: "target";
      }
    | {
        // error occurred in unknown
        type: "unknown";
      }
    | {
        // error occurred in advice
        type: "advice";
        advice: Advice;
      };
};
