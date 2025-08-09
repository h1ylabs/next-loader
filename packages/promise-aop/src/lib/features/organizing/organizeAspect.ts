import {
  Advice,
  type AdviceFunctionWithContext,
  type AdviceMetadata,
} from "@/lib/models/advice";
import type { Aspect, AspectOrganization } from "@/lib/models/aspect";
import type { RequiredBuildOptions } from "@/lib/models/buildOptions";
import { exhaustiveCheckType } from "@/lib/utils/validateType";

import { processBatchAdvice } from "../processing/processBatchAdvice";
import { organizeAdvice } from "./organizeAdvice";

export async function organizeAspect<Result, SharedContext>({
  aspects,
  buildOptions,
}: __Props<Result, SharedContext>): Promise<__Return<Result, SharedContext>> {
  // collecting advices
  const advices: {
    readonly [AdviceType in Advice]: (readonly [
      string,
      AdviceMetadata<Result, SharedContext, AdviceType>,
    ])[];
  } = {
    before: [],
    around: [],
    afterReturning: [],
    afterThrowing: [],
    after: [],
  } as const;

  for (const aspect of aspects) {
    for (const adviceType of Advice) {
      switch (adviceType) {
        case "before":
          if (aspect.before) {
            advices[adviceType].push([aspect.name, aspect.before]);
          }
          break;
        case "around":
          if (aspect.around) {
            advices[adviceType].push([aspect.name, aspect.around]);
          }
          break;
        case "afterReturning":
          if (aspect.afterReturning) {
            advices[adviceType].push([aspect.name, aspect.afterReturning]);
          }
          break;
        case "afterThrowing":
          if (aspect.afterThrowing) {
            advices[adviceType].push([aspect.name, aspect.afterThrowing]);
          }
          break;
        case "after":
          if (aspect.after) {
            advices[adviceType].push([aspect.name, aspect.after]);
          }
          break;
        default:
          exhaustiveCheckType(adviceType);
      }
    }
  }

  // organizing advice
  const adviceOrganization = await Promise.all(
    Advice.map(
      async (advice) =>
        [
          advice,
          await organizeAdvice({
            options: buildOptions.advice[advice],
            adviceGroup: advices[advice],
          }),
        ] as const,
    ),
  );

  // batch-processing advice
  const batchedAdvice = adviceOrganization.map(([adviceType, execution]) => {
    type Fn = AdviceFunctionWithContext<
      Result,
      SharedContext,
      typeof adviceType
    >;

    const adviceFn: Fn = async (context, ...args) =>
      await processBatchAdvice({
        options: buildOptions.advice[adviceType],
        execution,
        adviceType,
        context,
        args,
      });

    return [adviceType, adviceFn] as const;
  });

  const organization = Object.fromEntries(batchedAdvice) as AspectOrganization<
    Result,
    SharedContext
  >;

  return organization;
}

export type __Props<Result, SharedContext> = {
  readonly aspects: readonly Aspect<Result, SharedContext>[];
  readonly buildOptions: RequiredBuildOptions;
};

export type __Return<Result, SharedContext> = AspectOrganization<
  Result,
  SharedContext
>;
