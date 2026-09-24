import type { JsonObject, JsonValue } from './types.js';

/** Keys that could reach an object prototype when data is later merged by assignment. */
export const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

export function isJsonObject(value: unknown): value is JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
}

function assertKey(key: string): void {
  if (FORBIDDEN_KEYS.has(key)) throw new TypeError(`Property name "${key}" is not allowed.`);
}

/** Defines an own data property, so no key can invoke a prototype setter. */
export function defineValue(target: JsonObject, key: string, value: JsonValue): void {
  assertKey(key);
  Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
}

export function copyObject(source: JsonObject): JsonObject {
  const copy: JsonObject = {};
  for (const [key, value] of Object.entries(source)) defineValue(copy, key, value);
  return copy;
}

export function cloneJson<T extends JsonValue>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => cloneJson(item)) as T;
  if (isJsonObject(value)) {
    const copy: JsonObject = {};
    for (const [key, item] of Object.entries(value)) defineValue(copy, key, cloneJson(item));
    return copy as T;
  }
  return value;
}

export function getAt(node: JsonValue | undefined, path: readonly string[]): JsonValue | undefined {
  let current: JsonValue | undefined = node;
  for (const key of path) {
    if (!isJsonObject(current) || !Object.hasOwn(current, key)) return undefined;
    current = current[key];
  }
  return current;
}

/**
 * True when `path` can be written without replacing an existing non-object value
 * (for example an imported string where the form expects a nested object).
 */
export function canWriteAt(node: JsonObject, path: readonly string[]): boolean {
  let current: JsonValue | undefined = node;
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index]!;
    if (FORBIDDEN_KEYS.has(key)) return false;
    const next: JsonValue | undefined = isJsonObject(current) && Object.hasOwn(current, key) ? current[key] : undefined;
    if (next === undefined) return true;
    if (!isJsonObject(next)) return false;
    current = next;
  }
  const last = path[path.length - 1];
  return last !== undefined && !FORBIDDEN_KEYS.has(last);
}

function isEmptyValue(value: JsonValue | undefined): boolean {
  return value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

/**
 * Returns a copy of `node` with `value` written at `path`. Missing intermediate
 * objects are created with the `@type` named in `nodeTypes` (keyed by dotted path).
 * An empty value removes the leaf; parents are kept so explicit type choices stay.
 */
export function setAt(
  node: JsonObject,
  path: readonly string[],
  value: JsonValue | undefined,
  nodeTypes: Readonly<Record<string, string>> = {},
  prefix: readonly string[] = [],
): JsonObject {
  const [head, ...rest] = path;
  if (head === undefined) throw new TypeError('Path must not be empty.');
  assertKey(head);
  const copy = copyObject(node);
  if (rest.length === 0) {
    if (isEmptyValue(value)) delete copy[head];
    else defineValue(copy, head, value as JsonValue);
    return copy;
  }
  const childPath = [...prefix, head];
  const existing = Object.hasOwn(copy, head) ? copy[head] : undefined;
  let child: JsonObject;
  if (isJsonObject(existing)) child = existing;
  else if (existing === undefined) {
    if (isEmptyValue(value)) return copy;
    const type = nodeTypes[childPath.join('.')];
    child = type ? { '@type': type } : {};
  } else {
    throw new TypeError(`Cannot write below non-object value at "${childPath.join('.')}".`);
  }
  defineValue(copy, head, setAt(child, rest, value, nodeTypes, childPath));
  return copy;
}

export function removeAt(node: JsonObject, path: readonly string[]): JsonObject {
  return setAt(node, path, undefined);
}

/** Reads a list value; a single object is treated as a one-item list. */
export function listAt(node: JsonObject, path: readonly string[]): JsonValue[] {
  const value = getAt(node, path);
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export function textOf(value: JsonValue | undefined): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return undefined;
}

export function textsOf(value: JsonValue | undefined): string[] {
  if (value === undefined) return [];
  const items = Array.isArray(value) ? value : [value];
  return items.map((item) => textOf(item)).filter((item): item is string => item !== undefined);
}

export function typesOf(node: JsonObject): string[] {
  const type = node['@type'];
  if (typeof type === 'string') return [type];
  if (Array.isArray(type)) return type.filter((item): item is string => typeof item === 'string');
  return [];
}
