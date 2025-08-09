import type { Advice } from "@/lib/models/advice";

export class AdviceError extends Error {
  constructor(
    public readonly advice: Advice,
    public readonly errors: unknown[],
  ) {
    super(MSG_ERROR_ADVICE_NOT_CALLED_FROM_OUTSIDE);
  }
}

export const MSG_ERROR_ADVICE_NOT_CALLED_FROM_OUTSIDE =
  "AdviceError must not be called from outside.";
