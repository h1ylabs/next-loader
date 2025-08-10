export class TargetError extends Error {
  constructor(error: unknown) {
    super(MSG_ERROR_TARGET_ERROR);
    this.cause = error;
  }
}

export const MSG_ERROR_TARGET_ERROR =
  "TargetError must not be called from outside.";
