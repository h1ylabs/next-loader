import type { HaltError } from "@/lib/errors/HaltError";
import {
  type NormalizableOptions,
  normalizeOptions,
} from "@/lib/utils/normalizeOptions";

export type RequiredProcessOptions<Result> = {
  readonly onResolveError: (error: HaltError) => Promise<Result>;
  readonly onResolveContinuedError: (error: unknown[]) => void;
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
    onResolveError: async (error) => {
      throw error;
    },
    onResolveContinuedError: () => {},
  } as const satisfies RequiredProcessOptions<Result>;
}
