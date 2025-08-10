export function validateType<T extends readonly unknown[], V extends T[number]>(
  array: T,
  value: V,
): V {
  if (!array.includes(value)) {
    throw new Error(MSG_ERR_INVALID_TYPE(value));
  }

  return value;
}

export function exhaustiveCheckType<T extends never>(value: T) {
  throw new Error(MSG_ERR_EXHAUSTIVE_CHECK(value));
}

export const MSG_ERR_INVALID_TYPE = (value: unknown) =>
  `invalid type: ${value}`;

export const MSG_ERR_EXHAUSTIVE_CHECK = (value: never) =>
  `unresolved value: ${value}`;
