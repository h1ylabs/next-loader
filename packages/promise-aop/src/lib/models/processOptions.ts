import {
  type NormalizableOptions,
  normalizeOptions,
} from "@/lib/utils/normalizeOptions";

import type { Target } from "./target";

export type RequiredProcessOptions<Result, SharedContext> = {
  readonly resolveHaltRejection: (
    context: () => SharedContext,
    exit: <T>(callback: () => T) => T,
    error: unknown,
  ) => Promise<Target<Result>>;
  readonly resolveContinuousRejection: (
    context: () => SharedContext,
    exit: <T>(callback: () => T) => T,
    error: unknown[],
  ) => Promise<void>;
};

export type ProcessOptions<Result, SharedContext> = NormalizableOptions<
  RequiredProcessOptions<Result, SharedContext>
>;

export function normalizeProcessOptions<Result, SharedContext>(
  options?: ProcessOptions<Result, SharedContext>,
  defaultOptions: RequiredProcessOptions<
    Result,
    SharedContext
  > = defaultProcessOptions(),
): RequiredProcessOptions<Result, SharedContext> {
  return normalizeOptions(defaultOptions, options);
}

export function defaultProcessOptions<Result, SharedContext>() {
  return {
    resolveHaltRejection: async (_context, _exit, error) => {
      throw error;
    },
    resolveContinuousRejection: async () => {},
  } as const satisfies RequiredProcessOptions<Result, SharedContext>;
}
