import { HaltError } from "./HaltError";

export class UnknownHaltError extends HaltError {
  constructor(error: unknown) {
    super(error);
  }
}
