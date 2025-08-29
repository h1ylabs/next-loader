export type NormalizableOptions<T> = T extends object
  ? T extends (...args: never) => unknown
    ? T
    : T extends readonly unknown[]
      ? T
      : {
          readonly [K in keyof T]?: NormalizableOptions<T[K]>;
        }
  : T;

export function normalizeOptions<T, U extends NormalizableOptions<T>>(
  source: T,
  target: U | null | undefined,
): T {
  if (isNullish(target)) {
    return source;
  }
  if (source !== undefined && isDifferentType(source, target)) {
    throw new Error(MSG_ERR_NORMALIZE_OPTIONS_TYPE_MISMATCH);
  }
  if (!isObject(source) || !isObject(target)) {
    return target as T;
  }
  if (isArray(source) || isFunction(source)) {
    return target as T;
  }

  const result = { ...source };

  Object.entries(target).forEach(([key, value]) => {
    const prevValue = source[key as keyof typeof source];

    if (!isObject(value)) {
      Object.assign(result, { [key]: value });
      return;
    }

    Object.assign(result, { [key]: normalizeOptions(prevValue, value) });
  });

  return result;
}

export const MSG_ERR_NORMALIZE_OPTIONS_TYPE_MISMATCH =
  "normalizable options type mismatch: source and target must have the same type";
export const MSG_ERR_NORMALIZE_OPTIONS_UNKNOWN_PROPERTY = (key: string) =>
  `unknown normalizable options property: '${key}' not found in source object`;

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
