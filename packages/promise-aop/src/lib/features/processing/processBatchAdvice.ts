import { Advice, AdviceExecution, AdviceFunction } from "@/lib/models/advice";
import {
  AggregationUnit,
  RequiredBuildOptions,
} from "@/lib/models/buildOptions";
import { Rejection } from "@/lib/models/rejection";
import {
  RestrictedContext,
  type SectionsUsed,
} from "@/lib/utils/RestrictedContext";
import { exhaustiveCheckType, validateType } from "@/lib/utils/validateType";

export async function processBatchAdvice<
  Result,
  SharedContext,
  AdviceType extends Advice,
>({
  context,
  options,
  adviceType,
  execution,
  args,
}: __Props<Result, SharedContext, AdviceType>) {
  // 1. shared context restriction
  const restrictedContext = new RestrictedContext(context);

  // 2. error aggregation from advice
  const aggregation = validateType(AggregationUnit, options.error.aggregation);
  const errorCollected = [];

  for (const group of execution) {
    const result = await Promise.allSettled(
      group.map((task) => {
        return restrictedContext.use(
          async (ctx) => task.advice(ctx, ...args),
          task.use ?? ([] as SectionsUsed<SharedContext>),
        );
      }),
    );

    // errors(rejections) from unit advice
    const errors = result
      .filter((r) => r.status === "rejected")
      .map((r) => r.reason);

    if (errors.length === 0) {
      continue;
    }

    switch (aggregation) {
      case "unit":
        throw new Rejection(errors, {
          occurredFrom: "advice",
          advice: adviceType,
        });
      case "all":
        errorCollected.push(...errors);
        break;
      default:
        exhaustiveCheckType(aggregation);
    }
  }

  // throw errors if there are errors collected
  if (errorCollected.length > 0) {
    throw new Rejection(errorCollected, {
      occurredFrom: "advice",
      advice: adviceType,
    });
  }
}

export type __Props<Result, SharedContext, AdviceType extends Advice> = {
  readonly execution: AdviceExecution<Result, SharedContext, AdviceType>;
  readonly options: RequiredBuildOptions["advice"][keyof RequiredBuildOptions["advice"]];
  readonly adviceType: AdviceType;
  readonly context: SharedContext;
  readonly args: Parameters<AdviceFunction<Result, AdviceType>>;
};
