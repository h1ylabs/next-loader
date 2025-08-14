import { randomUUID } from "node:crypto";

export type ID<T extends string> = `id:${T}:${string}`;

export function generateID<T extends string>(name: T): ID<T> {
  return `id:${name}:${randomUUID()}`;
}
