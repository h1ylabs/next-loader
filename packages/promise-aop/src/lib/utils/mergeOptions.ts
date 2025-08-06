/**
 * recursively makes all properties of an object type optional.
 */
export type MergeableOptions<T> = T extends object
  ? T extends (...args: never) => unknown
    ? T
    : T extends readonly unknown[]
      ? T
      : {
          readonly [K in keyof T]?: MergeableOptions<T[K]>;
        }
  : T;

/**
 * applies configuration overrides to a source object.
 * @param source - The base configuration object
 * @param target - The configuration overrides to apply
 * @returns The merged configuration object
 */
export function mergeOptions<T, U extends MergeableOptions<T>>(
  source: T,
  target: U | null | undefined,
): T {
  if (isNullish(target)) {
    return source;
  }
  if (isDifferentType(source, target)) {
    throw new Error(MSG_ERR_MERGE_OPTIONS_TYPE_MISMATCH);
  }
  if (!isObject(source) || !isObject(target)) {
    return target as T;
  }
  if (isArray(source) || isFunction(source)) {
    return target as T;
  }

  // validate that target only contains properties that exist in source
  for (const key in target) {
    if (!Object.hasOwn(source as object, key)) {
      throw new Error(MSG_ERR_MERGE_OPTIONS_UNKNOWN_PROPERTY(key));
    }
  }

  const result = { ...source };

  Object.entries(target).forEach(([key, value]) => {
    const prevValue = source[key as keyof typeof source];

    if (!isObject(value)) {
      Object.assign(result, { [key]: value });
      return;
    }

    Object.assign(result, { [key]: mergeOptions(prevValue, value) });
  });

  return result;
}

export const MSG_ERR_MERGE_OPTIONS_TYPE_MISMATCH =
  "mergeable options type mismatch: source and target must have the same type";
export const MSG_ERR_MERGE_OPTIONS_UNKNOWN_PROPERTY = (key: string) =>
  `unknown mergeable options property: '${key}' not found in source object`;

// type guards
function isDifferentType<P, Q>(a: P, b: Q) {
  return typeof a !== typeof b;
}

function isObject<T>(value: T) {
  return typeof value === "object" && value !== null;
}

function isArray<T>(value: T) {
  return Array.isArray(value);
}

function isNullish<T>(value: T) {
  return value === null || value === undefined;
}

function isFunction<T>(value: T) {
  return typeof value === "function";
}
