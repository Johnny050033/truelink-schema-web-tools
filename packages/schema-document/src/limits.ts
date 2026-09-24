/**
 * Application limits proposed in the product plan. They bound local storage and
 * parsing work; a limit hit is reported, never silently truncated.
 */
export const LIMITS = Object.freeze({
  /** Serialized JSON-LD per document, UTF-8 bytes. */
  documentBytes: 100 * 1024,
  /** Total pasted/imported text per import action, UTF-8 bytes. */
  importBytes: 300 * 1024,
  /** Nesting depth of one JSON value. */
  maxDepth: 20,
  /** Values (objects, arrays and primitives) in one JSON document. */
  maxNodes: 2_000,
  /** Candidate nodes/blocks accepted from one import. */
  maxImportBlocks: 20,
  /** UTF-16 code units in one string value. */
  maxStringLength: 20_000,
});

export function utf8Bytes(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
      const next = text.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}
