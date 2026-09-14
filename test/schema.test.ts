import { describe, expect, it } from "vitest";
import { MAX_ISSUES, MAX_SCHEMA_FIELDS, MAX_STRING_LENGTH, validateSchema } from "../src/schema.js";
import { accountSchema } from "./fixtures/schema.js";

const codes = (value: unknown, schema = accountSchema) => validateSchema(value, schema).issues.map((issue) => issue.code);

describe("validateSchema synthetic cases", () => {
  it("accepts a valid flat object without mutation", () => {
    const input = { displayName: "A😀", role: "member", score: 4, active: true };
    expect(validateSchema(input, accountSchema)).toEqual({ valid: true, issues: [] });
    expect(input).toEqual({ displayName: "A😀", role: "member", score: 4, active: true });
  });

  it("requires required fields", () => expect(codes({ active: true })).toContain("required"));
  it("rejects unknown fields including prototype-sensitive names", () => {
    expect(codes({ displayName: "Jo", active: true, constructor: "x" })).toContain("unknown_field");
  });
  it("rejects every supplied server-managed value, including undefined", () => {
    expect(codes({ displayName: "Jo", active: true, createdAt: undefined })).toContain("server_managed");
  });
  it("uses Unicode code points rather than UTF-16 code units", () => {
    expect(validateSchema({ name: "😀😀" }, { name: { type: "string", maxLength: 2 } }).valid).toBe(true);
  });
  it("checks string bounds and exact enum values", () => {
    expect(codes({ displayName: "J", role: "Member", active: true })).toEqual(expect.arrayContaining(["min_length", "enum"]));
  });
  it("rejects non-finite and out-of-range numbers", () => {
    expect(codes({ displayName: "Jo", score: Number.NaN, active: true })).toContain("invalid_type");
    expect(codes({ displayName: "Jo", score: 11, active: true })).toContain("max");
  });
  it("rejects wrong primitive types, null, arrays, and non-plain objects", () => {
    expect(codes({ displayName: 4, active: "yes" })).toEqual(expect.arrayContaining(["invalid_type", "invalid_type"]));
    expect(codes(null)).toEqual(["invalid_object"]);
    expect(codes([])).toEqual(["invalid_object"]);
    expect(codes(new Date())).toEqual(["invalid_object"]);
  });
  it("rejects accessor input without invoking its getter", () => {
    let invoked = false;
    const input = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(input, "displayName", { enumerable: true, get: () => { invoked = true; return "Jo"; } });
    input.active = true;
    expect(codes(input)).toContain("accessor_field");
    expect(invoked).toBe(false);
  });
  it("fails closed for malformed trusted schemas", () => {
    expect(() => validateSchema({}, { x: { type: "string", minLength: 3, maxLength: 2 } })).toThrow(TypeError);
    expect(() => validateSchema({}, { x: { type: "number", min: Infinity } })).toThrow(TypeError);
    expect(() => validateSchema({}, { x: { type: "string", enum: ["ok", 2] } as never })).toThrow(TypeError);
    expect(() => validateSchema({}, { x: { type: "boolean", min: 0 } as never })).toThrow(TypeError);
  });
  it("does not execute schema accessors", () => {
    const rule = Object.create(null);
    Object.defineProperty(rule, "type", { enumerable: true, get: () => "string" });
    expect(() => validateSchema({}, { x: rule })).toThrow(TypeError);
  });
  it("enforces schema and input size limits", () => {
    const schema = Object.fromEntries(Array.from({ length: MAX_SCHEMA_FIELDS + 1 }, (_, i) => [`x${i}`, { type: "boolean" as const }]));
    expect(() => validateSchema({}, schema)).toThrow(TypeError);
    expect(codes({ name: "x".repeat(MAX_STRING_LENGTH + 1) }, { name: { type: "string" } })).toEqual(["string_too_long"]);
  });
  it("caps issue output", () => {
    const schema = Object.fromEntries(Array.from({ length: MAX_SCHEMA_FIELDS }, (_, i) => [`x${i}`, { type: "string" as const, required: true }]));
    expect(validateSchema({}, schema).issues).toHaveLength(MAX_ISSUES);
  });
  it("rejects non-enumerable unknown fields and symbol keys", () => {
    const input = { displayName: "Jo", active: true };
    Object.defineProperty(input, "hidden", { value: "not allowed" });
    expect(codes(input)).toContain("unknown_field");
    expect(codes({ displayName: "Jo", active: true, [Symbol("hidden")]: true })).toContain("unknown_field");
  });
  it("rejects JSON prototype-sensitive keys without prototype mutation", () => {
    for (const key of ["__proto__", "constructor", "prototype"]) {
      expect(validateSchema(JSON.parse(`{"${key}": "x"}`), {}).valid).toBe(false);
      expect(() => validateSchema({}, JSON.parse(`{"${key}": {"type":"string"}}`))).toThrow(TypeError);
    }
    expect(Object.prototype).not.toHaveProperty("polluted");
  });
  it("does not require clients to provide server-managed required fields", () => {
    const schema = { createdAt: { type: "string" as const, required: true, serverManaged: true } };
    expect(validateSchema({}, schema).valid).toBe(true);
    expect(validateSchema({ createdAt: undefined }, schema).valid).toBe(false);
  });
  it("rejects excessive input fields and malformed hidden schema settings", () => {
    expect(validateSchema(Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`x${i}`, true])), {}).issues[0]?.code).toBe("input_limit");
    const rule = { type: "boolean" as const };
    Object.defineProperty(rule, "min", { value: 0 });
    expect(() => validateSchema({}, { flag: rule })).toThrow(TypeError);
    expect(() => validateSchema({}, { [Symbol("bad")]: { type: "string" } } as never)).toThrow(TypeError);
    expect(() => validateSchema({}, { text: { type: "string", enum: Array.from({ length: 1_001 }, () => "x") } })).toThrow(TypeError);
  });
  it("checks upper string length, lower numeric bound and strict booleans", () => {
    expect(codes({ displayName: "0123456789", score: -1, active: 1 })).toEqual(expect.arrayContaining(["max_length", "min", "invalid_type"]));
  });
});
