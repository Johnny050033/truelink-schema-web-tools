import type { FieldRule } from "../../src/schema.js";

export const accountSchema: Record<string, FieldRule> = {
  displayName: { type: "string", required: true, minLength: 2, maxLength: 8 },
  role: { type: "string", enum: ["member", "admin"] },
  score: { type: "number", min: 0, max: 10 },
  active: { type: "boolean", required: true },
  createdAt: { type: "string", serverManaged: true },
};
