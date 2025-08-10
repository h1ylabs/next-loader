export class UnknownError extends Error {
  constructor(error: unknown) {
    super(MSG_ERROR_UNKNOWN_ERROR);
    this.cause = error;
  }
}

export const MSG_ERROR_UNKNOWN_ERROR =
  "UnknownError must not be called from outside.";
