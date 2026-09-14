/** A deliberately small runtime validator for flat, JSON-compatible records. */
export type FieldRule =
  | StringFieldRule
  | NumberFieldRule
  | BooleanFieldRule;

type SharedFieldRule = {
  required?: boolean;
  serverManaged?: boolean;
};

export type StringFieldRule = SharedFieldRule & {
  type: "string";
  minLength?: number;
  maxLength?: number;
  enum?: readonly string[];
};

export type NumberFieldRule = SharedFieldRule & {
  type: "number";
  min?: number;
  max?: number;
};

export type BooleanFieldRule = SharedFieldRule & { type: "boolean" };

export type ValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export type ValidationResult = { valid: boolean; issues: ValidationIssue[] };

export const MAX_SCHEMA_FIELDS = 100;
export const MAX_STRING_LENGTH = 100_000;
export const MAX_ISSUES = 64;

const ruleKeys = new Set([
  "type",
  "required",
  "serverManaged",
  "minLength",
  "maxLength",
  "enum",
  "min",
  "max",
]);

type CheckedRule = FieldRule;

function configKeys(value: object): string[] {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string")) throw new TypeError("Schema symbol keys are not supported.");
  return keys as string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function dataProperty(object: object, key: string): PropertyDescriptor | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (descriptor && !("value" in descriptor)) {
    throw new TypeError(`Schema property "${key}" must not be an accessor.`);
  }
  return descriptor;
}

function optionalBoolean(rule: object, key: "required" | "serverManaged"): void {
  const descriptor = dataProperty(rule, key);
  if (descriptor && typeof descriptor.value !== "boolean") {
    throw new TypeError(`Schema property "${key}" must be a boolean.`);
  }
}

function optionalBound(rule: object, key: "minLength" | "maxLength"): number | undefined {
  const descriptor = dataProperty(rule, key);
  if (!descriptor) return undefined;
  const value = descriptor.value;
  if (!Number.isInteger(value) || value < 0 || value > MAX_STRING_LENGTH) {
    throw new TypeError(`Schema property "${key}" must be an integer from 0 to ${MAX_STRING_LENGTH}.`);
  }
  return value as number;
}

function optionalFinite(rule: object, key: "min" | "max"): number | undefined {
  const descriptor = dataProperty(rule, key);
  if (!descriptor) return undefined;
  if (typeof descriptor.value !== "number" || !Number.isFinite(descriptor.value)) {
    throw new TypeError(`Schema property "${key}" must be a finite number.`);
  }
  return descriptor.value;
}

function checkRule(name: string, candidate: unknown): CheckedRule {
  if (!isPlainObject(candidate)) throw new TypeError(`Schema rule "${name}" must be a plain object.`);
  const candidateKeys = configKeys(candidate);
  for (const key of candidateKeys) {
    if (!ruleKeys.has(key)) throw new TypeError(`Schema rule "${name}" has unknown property "${key}".`);
  }
  optionalBoolean(candidate, "required");
  optionalBoolean(candidate, "serverManaged");
  const type = dataProperty(candidate, "type")?.value;
  if (type !== "string" && type !== "number" && type !== "boolean") {
    throw new TypeError(`Schema rule "${name}" must have type "string", "number", or "boolean".`);
  }
  const permittedKeys = type === "string"
    ? new Set(["type", "required", "serverManaged", "minLength", "maxLength", "enum"])
    : type === "number"
      ? new Set(["type", "required", "serverManaged", "min", "max"])
      : new Set(["type", "required", "serverManaged"]);
  for (const key of candidateKeys) {
    if (!permittedKeys.has(key)) {
      throw new TypeError(`Schema rule "${name}" property "${key}" is incompatible with type "${type}".`);
    }
  }

  if (type === "string") {
    const minLength = optionalBound(candidate, "minLength");
    const maxLength = optionalBound(candidate, "maxLength");
    if (minLength !== undefined && maxLength !== undefined && minLength > maxLength) {
      throw new TypeError(`Schema rule "${name}" has minLength greater than maxLength.`);
    }
    const enumDescriptor = dataProperty(candidate, "enum");
    if (enumDescriptor) {
      if (!Array.isArray(enumDescriptor.value) || enumDescriptor.value.length > 1_000) {
        throw new TypeError(`Schema rule "${name}" enum must be an array of strings.`);
      }
      for (let index = 0; index < enumDescriptor.value.length; index += 1) {
        const item = Object.getOwnPropertyDescriptor(enumDescriptor.value, String(index));
        if (!item || !("value" in item) || typeof item.value !== "string" || codePointLength(item.value, MAX_STRING_LENGTH) > MAX_STRING_LENGTH) {
          throw new TypeError(`Schema rule "${name}" enum must be an array of data strings.`);
        }
      }
    }
  } else if (type === "number") {
    const min = optionalFinite(candidate, "min");
    const max = optionalFinite(candidate, "max");
    if (min !== undefined && max !== undefined && min > max) {
      throw new TypeError(`Schema rule "${name}" has min greater than max.`);
    }
  }
  return candidate as CheckedRule;
}

function codePointLength(value: string, stopAfter: number): number {
  let count = 0;
  for (const _ of value) {
    count += 1;
    if (count > stopAfter) return count;
  }
  return count;
}

/**
 * Validates a flat, plain record. It neither coerces nor mutates user input.
 * Invalid trusted schema definitions throw TypeError; invalid user input returns issues.
 */
export function validateSchema(input: unknown, schema: Record<string, FieldRule>): ValidationResult {
  if (!isPlainObject(schema)) throw new TypeError("Schema must be a plain object.");
  const schemaKeys = configKeys(schema);
  if (schemaKeys.length > MAX_SCHEMA_FIELDS) {
    throw new TypeError(`Schema has more than ${MAX_SCHEMA_FIELDS} fields.`);
  }
  const rules = new Map<string, CheckedRule>();
  for (const key of schemaKeys) {
    if (["__proto__", "constructor", "prototype"].includes(key)) throw new TypeError("Prototype-sensitive schema field names are forbidden.");
    rules.set(key, checkRule(key, dataProperty(schema, key)?.value));
  }

  const issues: ValidationIssue[] = [];
  const add = (code: string, path: string, message: string) => {
    if (issues.length < MAX_ISSUES) issues.push({ code, path, message });
  };
  if (!isPlainObject(input)) {
    add("invalid_object", "$", "Input must be a plain, non-null object.");
    return { valid: false, issues };
  }

  let inputKeys: string[];
  try {
    const keys = Reflect.ownKeys(input);
    if (keys.some((key) => typeof key !== "string")) add("unknown_field", "$", "Symbol fields are not supported.");
    inputKeys = keys.filter((key): key is string => typeof key === "string");
  } catch {
    add("invalid_object", "$", "Input object could not be inspected safely.");
    return { valid: false, issues };
  }
  if (inputKeys.length > MAX_SCHEMA_FIELDS) {
    add("input_limit", "$", `Input has more than ${MAX_SCHEMA_FIELDS} own fields.`);
    return { valid: false, issues };
  }
  for (const key of inputKeys) {
    if (!rules.has(key)) add("unknown_field", `$.${key}`, "Field is not allowed.");
  }

  for (const [key, rule] of rules) {
    if (issues.length >= MAX_ISSUES) break;
    let property: PropertyDescriptor | undefined;
    try {
      property = Object.getOwnPropertyDescriptor(input, key);
    } catch {
      add("invalid_object", "$", "Input object could not be inspected safely.");
      break;
    }
    if (!property) {
      if (rule.required && !rule.serverManaged) add("required", `$.${key}`, "Field is required.");
      continue;
    }
    if (!("value" in property)) {
      add("accessor_field", `$.${key}`, "Accessor properties are not allowed.");
      continue;
    }
    if (rule.serverManaged) {
      add("server_managed", `$.${key}`, "Field is managed by the server and must not be supplied.");
      continue;
    }
    const value = property.value;
    if (typeof value !== rule.type || (rule.type === "number" && !Number.isFinite(value))) {
      add("invalid_type", `$.${key}`, `Expected a finite ${rule.type}.`);
      continue;
    }
    if (rule.type === "string") {
      const length = codePointLength(value, MAX_STRING_LENGTH);
      if (length > MAX_STRING_LENGTH) add("string_too_long", `$.${key}`, `String exceeds ${MAX_STRING_LENGTH} Unicode code points.`);
      else if (rule.minLength !== undefined && length < rule.minLength) add("min_length", `$.${key}`, `String must have at least ${rule.minLength} Unicode code points.`);
      else if (rule.maxLength !== undefined && length > rule.maxLength) add("max_length", `$.${key}`, `String must have at most ${rule.maxLength} Unicode code points.`);
      else if (rule.enum !== undefined && !rule.enum.includes(value)) add("enum", `$.${key}`, "String is not an allowed value.");
    } else if (rule.type === "number") {
      if (rule.min !== undefined && value < rule.min) add("min", `$.${key}`, `Number must be at least ${rule.min}.`);
      else if (rule.max !== undefined && value > rule.max) add("max", `$.${key}`, `Number must be at most ${rule.max}.`);
    }
  }
  return { valid: issues.length === 0, issues };
}
