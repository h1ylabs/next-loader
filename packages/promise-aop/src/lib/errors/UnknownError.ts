export class UnknownError extends Error {
  constructor(error: unknown) {
    super();
    this.cause = error;
  }
}
