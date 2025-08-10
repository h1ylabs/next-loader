import type { HaltError } from "@/lib/errors/HaltError";
import {
  type NormalizableOptions,
  normalizeOptions,
} from "@/lib/utils/normalizeOptions";

export type RequiredProcessOptions<Result> = {
  readonly resolveHaltRejection: (error: HaltError) => Promise<Result>;
  readonly resolveContinuousRejection: (error: unknown[]) => void;
};

export type ProcessOptions<Result> = NormalizableOptions<
  RequiredProcessOptions<Result>
>;

export function normalizeProcessOptions<Result>(
  options?: ProcessOptions<Result>,
  defaultOptions: RequiredProcessOptions<Result> = defaultProcessOptions(),
): RequiredProcessOptions<Result> {
  return normalizeOptions(defaultOptions, options);
}

export function defaultProcessOptions<Result>() {
  return {
    resolveHaltRejection: async (error) => {
      throw error;
    },
    resolveContinuousRejection: () => {},
  } as const satisfies RequiredProcessOptions<Result>;
}
