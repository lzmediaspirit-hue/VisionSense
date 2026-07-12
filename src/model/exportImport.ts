// JSON export/import for a single chart (SPEC 4.2). The export is a small
// versioned envelope around a Chart; import re-validates with the same
// structural rules used for localStorage persistence (see storage.ts) so a
// hand-edited, foreign, or corrupt file can never crash the app — it is
// rejected with a friendly, specific error instead.

import { newId } from './id';
import { isObject, validateChart } from './storage';
import type { Chart } from './types';

export const CHART_EXPORT_KIND = 'visionsense.chart';
export const CHART_EXPORT_VERSION = 1;

export interface ChartExportEnvelope {
  kind: typeof CHART_EXPORT_KIND;
  schemaVersion: typeof CHART_EXPORT_VERSION;
  exportedAt: string; // ISO
  chart: Chart;
}

/** Build the versioned export envelope for a single chart. */
export function buildChartExport(
  chart: Chart,
  now: () => string = () => new Date().toISOString(),
): ChartExportEnvelope {
  return {
    kind: CHART_EXPORT_KIND,
    schemaVersion: CHART_EXPORT_VERSION,
    exportedAt: now(),
    chart,
  };
}

/** Pretty-printed JSON for a single chart export (what gets written to disk). */
export function serializeChartExport(chart: Chart, now?: () => string): string {
  return JSON.stringify(buildChartExport(chart, now), null, 2);
}

export type ImportResult = { ok: true; chart: Chart } | { ok: false; error: string };

/**
 * Parse + strictly validate an exported chart file. Never throws: any
 * malformed input yields a friendly ImportResult error instead. The returned
 * chart (on success) always carries a FRESH id, so importing never collides
 * with an existing chart.
 */
export function parseChartImport(raw: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }

  if (!isObject(parsed)) {
    return { ok: false, error: 'That file does not contain a VisionSense chart.' };
  }
  if (parsed.kind !== CHART_EXPORT_KIND || parsed.schemaVersion !== CHART_EXPORT_VERSION) {
    return { ok: false, error: 'That file is not a recognized VisionSense chart export.' };
  }

  const chart = validateChart(parsed.chart);
  if (!chart) {
    return { ok: false, error: 'That chart file is corrupted or incomplete.' };
  }

  return { ok: true, chart: { ...chart, id: newId() } };
}
