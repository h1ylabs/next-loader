import type { Advice } from "@/lib/models/advice";

export class AdviceError extends Error {
  constructor(
    public readonly advice: Advice,
    public readonly errors: unknown[],
  ) {
    super();
  }
}
