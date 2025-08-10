export class HaltError extends Error {
  constructor(error: unknown) {
    super(MSG_ERROR_HALTED_ERROR);
    this.cause = error;
  }
}

export const MSG_ERROR_HALTED_ERROR =
  "HaltError must not be called from outside.";
