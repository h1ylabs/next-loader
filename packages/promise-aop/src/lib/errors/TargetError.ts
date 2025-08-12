export class TargetError extends Error {
  constructor(error: unknown) {
    super();
    this.cause = error;
  }
}
