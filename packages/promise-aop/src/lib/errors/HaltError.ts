export class HaltError extends Error {
  constructor(error: unknown) {
    super();
    this.cause = error;
  }
}
