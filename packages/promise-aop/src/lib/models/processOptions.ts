import type { HaltError } from "@/lib/errors/HaltError";
import { type MergeableOptions, mergeOptions } from "@/lib/utils/mergeOptions";

export type RequiredProcessOptions<Result> = {
  readonly onResolveError: (error: HaltError) => Promise<Result>;
  readonly onResolveContinuedError: (error: unknown[]) => void;
};

export type ProcessOptions<Result> = MergeableOptions<
  RequiredProcessOptions<Result>
>;

export function applyProcessOptions<Result>(
  options?: ProcessOptions<Result>,
  defaultOptions: RequiredProcessOptions<Result> = defaultProcessOptions(),
): ProcessOptions<Result> {
  return mergeOptions(defaultOptions, options);
}

export function defaultProcessOptions<Result>() {
  return {
    onResolveError: async (error) => {
      throw error;
    },
    onResolveContinuedError: () => {},
  } as const satisfies RequiredProcessOptions<Result>;
}
