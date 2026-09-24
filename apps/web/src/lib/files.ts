/** Copies text, falling back to a hidden textarea where the async API is unavailable. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall back below */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export function downloadText(fileName: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** File-name-safe slug that keeps CJK characters. */
export function fileSlug(value: string, fallback = 'schema'): string {
  const slug = value
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return slug || fallback;
}

export function dateStamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

export async function readFileText(file: File, maxBytes: number): Promise<string> {
  if (file.size > maxBytes) throw new RangeError('too-large');
  return file.text();
}

/**
 * Extracts JSON-LD blocks from pasted HTML with DOMParser. Parsed documents are
 * inert: scripts do not run and resources are not fetched.
 */
export function extractJsonLd(text: string): { blocks: string[]; html: boolean } {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return { blocks: [trimmed], html: false };
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const blocks = [...doc.querySelectorAll('script')]
    .filter((script) => (script.getAttribute('type') ?? '').trim().toLowerCase() === 'application/ld+json')
    .map((script) => script.textContent ?? '');
  return { blocks, html: true };
}
