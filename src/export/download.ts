// Small browser-only helpers for triggering "Save As" downloads. Kept out of
// model/ because model/ is pure and unit-tested; these touch the DOM.

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Filesystem-safe filename stem derived from a chart's goal (or a fallback). */
export function chartFileStem(goal: string, fallback = 'mandala-chart'): string {
  const slug = goal
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}
