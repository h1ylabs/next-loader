import type {
  Advice,
  AdviceExecution,
  AdviceMetadata,
} from "@/lib/models/advice";
import {
  ExecutionStrategy,
  type RequiredBuildOptions,
} from "@/lib/models/buildOptions";
import { pipeAsync } from "@/lib/utils/pipeAsync";
import { exhaustiveCheckType, validateType } from "@/lib/utils/validateType";

export async function organizeAdvice<
  Result,
  SharedContext,
  AdviceType extends Advice,
>(
  props: __Props<Result, SharedContext, AdviceType>,
): Promise<__Return<Result, SharedContext, AdviceType>> {
  return pipeAsync(__preparePhase, __constructPhase, __resolvePhase)(props);
}

export function __preparePhase<
  Result,
  SharedContext,
  AdviceType extends Advice,
>({ options, adviceGroup }: __Props<Result, SharedContext, AdviceType>) {
  const mappings = new Map<
    AspectName,
    AdviceMetadata<Result, SharedContext, AdviceType>
  >();
  const countOfDependents = new Map<AspectName, number>();

  // prepare mappings
  for (const [aspect, advice] of adviceGroup) {
    if (mappings.has(aspect)) {
      const existingAdvice = mappings.get(aspect)!;
      throw new Error(
        MSG_ERR_RESOLVE_DEPS_DUPLICATE_ASPECT_ADVICE_WITH_CONTEXT(
          aspect,
          existingAdvice,
          advice,
        ),
      );
    }

    mappings.set(aspect, advice);
    countOfDependents.set(aspect, 0);
  }

  return { options, mappings, countOfDependents };
}

export function __constructPhase<
  Result,
  SharedContext,
  AdviceType extends Advice,
>({
  options,
  mappings,
  countOfDependents,
}: ReturnType<typeof __preparePhase<Result, SharedContext, AdviceType>>) {
  const aspectDependencyGraph = new Map<AspectName, Set<AspectName>>();

  for (const [aspect, advice] of mappings) {
    if (!advice.dependsOn) {
      continue;
    }

    for (const aspectDependent of advice.dependsOn) {
      if (!mappings.has(aspectDependent)) {
        const availableAspects = Array.from(mappings.keys());

        throw new Error(
          MSG_ERR_RESOLVE_DEPS_MISSING_DEPENDENCY_WITH_CONTEXT(
            aspect,
            aspectDependent,
            availableAspects,
          ),
        );
      }

      // add dependency
      const dependencies =
        aspectDependencyGraph.get(aspectDependent) ?? new Set();
      dependencies.add(aspect);
      aspectDependencyGraph.set(aspectDependent, dependencies);

      // update dependents count
      const count = countOfDependents.get(aspect) ?? 0;
      countOfDependents.set(aspect, count + 1);
    }
  }

  return { options, mappings, countOfDependents, aspectDependencyGraph };
}

export function __resolvePhase<
  Result,
  SharedContext,
  AdviceType extends Advice,
>({
  options,
  mappings,
  countOfDependents,
  aspectDependencyGraph,
}: ReturnType<
  typeof __constructPhase<Result, SharedContext, AdviceType>
>): AdviceMetadata<Result, SharedContext, AdviceType>[][] {
  const result: AdviceMetadata<Result, SharedContext, AdviceType>[][] = [];
  const execution = validateType(ExecutionStrategy, options.execution);
  const processed = new Set<AspectName>();

  while (processed.size < mappings.size) {
    const currentLevel: AspectName[] = [];

    for (const [aspect, inDegree] of countOfDependents.entries()) {
      if (inDegree === 0 && !processed.has(aspect)) {
        currentLevel.push(aspect);
      }
    }

    if (currentLevel.length === 0) {
      const cyclePath = findCyclePath(mappings, processed);
      throw new Error(MSG_ERR_RESOLVE_DEPS_CYCLE_DETECTED(cyclePath));
    }

    const currentAdvice: AdviceMetadata<Result, SharedContext, AdviceType>[] =
      [];
    const usedSections = new Map<PropertyKey, AspectName>();

    for (const aspect of currentLevel) {
      const advice = mappings.get(aspect)!;

      // check for section conflicts
      if (advice.use) {
        for (const section of advice.use) {
          const existingAspect = usedSections.get(section);

          if (existingAspect !== undefined) {
            throw new Error(
              MSG_ERR_RESOLVE_DEPS_SECTION_CONFLICT_WITH_CONTEXT(
                section,
                aspect,
                existingAspect,
              ),
            );
          }

          usedSections.set(section, aspect);
        }
      }

      // add advice to result
      currentAdvice.push(advice);
      processed.add(aspect);

      // update dependents count
      const dependents = aspectDependencyGraph.get(aspect) ?? [];

      for (const dependent of dependents) {
        const count = countOfDependents.get(dependent)!;
        countOfDependents.set(dependent, count - 1);
      }
    }

    switch (execution) {
      case "parallel":
        result.push(currentAdvice);
        break;
      case "sequential":
        result.push(...currentAdvice.map((advice) => [advice]));
        break;
      default:
        exhaustiveCheckType(execution);
    }
  }

  return result;
}

export function findCyclePath<Result, SharedContext, AdviceType extends Advice>(
  mappings: Map<AspectName, AdviceMetadata<Result, SharedContext, AdviceType>>,
  processed: Set<AspectName>,
): AspectName[] {
  const stack: AspectName[] = [];
  const onStack = new Set<AspectName>();
  const visited = new Set<AspectName>();

  function dfs(aspect: AspectName): AspectName[] | null {
    if (processed.has(aspect)) return null;
    if (onStack.has(aspect)) {
      const idx = stack.indexOf(aspect);
      return stack.slice(idx).concat(aspect);
    }
    if (visited.has(aspect)) return null;

    stack.push(aspect);
    onStack.add(aspect);

    const advice = mappings.get(aspect);
    if (advice?.dependsOn) {
      for (const dep of advice.dependsOn) {
        const cycle = dfs(dep);
        if (cycle) return cycle;
      }
    }

    stack.pop();
    onStack.delete(aspect);
    visited.add(aspect);

    return null;
  }

  for (const aspect of mappings.keys()) {
    if (!processed.has(aspect) && !visited.has(aspect)) {
      const cycle = dfs(aspect);
      if (cycle) return cycle;
    }
  }
  return [];
}

export const MSG_ERR_RESOLVE_DEPS_DUPLICATE_ASPECT_ADVICE_WITH_CONTEXT = <
  Result,
  SharedContext,
  AdviceType extends Advice,
>(
  aspect: string,
  existingAdviceMetadata: AdviceMetadata<Result, SharedContext, AdviceType>,
  newAdviceMetadata: AdviceMetadata<Result, SharedContext, AdviceType>,
): string => {
  const existing = existingAdviceMetadata.dependsOn?.join(",") || "-";
  const newDeps = newAdviceMetadata.dependsOn?.join(",") || "-";
  return `Duplicate aspect: ${aspect}\nExisting: ${existing}\nNew: ${newDeps}`;
};

export const MSG_ERR_RESOLVE_DEPS_MISSING_DEPENDENCY_WITH_CONTEXT = (
  aspect: string,
  dependency: string,
  availableAspects: string[],
): string =>
  `Missing dependency: ${aspect} → ${dependency}\nAvailable: ${availableAspects.join(
    ", ",
  )}`;

export const MSG_ERR_RESOLVE_DEPS_SECTION_CONFLICT_WITH_CONTEXT = (
  section: PropertyKey,
  currentAspect: string,
  existingAspect: string,
): string =>
  `Section conflict: ${String(section)} (${existingAspect}, ${currentAspect})`;

export const MSG_ERR_RESOLVE_DEPS_CYCLE_DETECTED = (
  cyclePath: string[],
): string => `Cycle: ${cyclePath.join(" → ")}`;

export type __Props<Result, SharedContext, AdviceType extends Advice> = {
  readonly adviceGroup: Iterable<
    readonly [AspectName, AdviceMetadata<Result, SharedContext, AdviceType>]
  >;
  readonly options: RequiredBuildOptions["advice"][keyof RequiredBuildOptions["advice"]];
};

export type __Return<
  Result,
  SharedContext,
  AdviceType extends Advice,
> = AdviceExecution<Result, SharedContext, AdviceType>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PropertyKey = keyof any;
type AspectName = string;
