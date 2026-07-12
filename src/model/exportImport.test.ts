import { describe, expect, it } from 'vitest';
import { createChart } from './factory';
import {
  buildChartExport,
  CHART_EXPORT_KIND,
  CHART_EXPORT_VERSION,
  parseChartImport,
  serializeChartExport,
} from './exportImport';
import { cycleActionStatus, renamePillar, setActionText } from './operations';

function sampleChart() {
  let chart = createChart({
    goal: 'Make the team',
    themeId: 'stadium',
    now: () => '2023-05-01T00:00:00.000Z',
  });
  chart = renamePillar(chart, 0, 'Strength', () => '2023-05-02T00:00:00.000Z');
  chart = setActionText(chart, 0, 0, 'Squat 3x/week', () => '2023-05-03T00:00:00.000Z');
  chart = cycleActionStatus(chart, 0, 0, () => '2023-05-04T00:00:00.000Z'); // todo -> doing
  return chart;
}

describe('exportImport', () => {
  it('builds a versioned envelope around the chart', () => {
    const chart = sampleChart();
    const envelope = buildChartExport(chart, () => '2023-06-01T00:00:00.000Z');
    expect(envelope.kind).toBe(CHART_EXPORT_KIND);
    expect(envelope.schemaVersion).toBe(CHART_EXPORT_VERSION);
    expect(envelope.exportedAt).toBe('2023-06-01T00:00:00.000Z');
    expect(envelope.chart).toEqual(chart);
  });

  it('round-trips export -> import: fresh id, otherwise identical content', () => {
    const chart = sampleChart();
    const json = serializeChartExport(chart, () => '2023-06-01T00:00:00.000Z');
    const result = parseChartImport(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.chart.id).not.toBe(chart.id);
    expect({ ...result.chart, id: chart.id }).toEqual(chart);
  });

  it('rejects invalid JSON with a friendly error, never throws', () => {
    expect(() => parseChartImport('{not valid json')).not.toThrow();
    const result = parseChartImport('{not valid json');
    expect(result).toEqual({ ok: false, error: expect.any(String) });
  });

  it('rejects well-formed JSON that is not a chart export envelope', () => {
    const result = parseChartImport(JSON.stringify({ hello: 'world' }));
    expect(result.ok).toBe(false);
  });

  it('rejects an envelope with the wrong kind or schema version', () => {
    const chart = sampleChart();
    const wrongKind = { ...buildChartExport(chart), kind: 'something-else' };
    expect(parseChartImport(JSON.stringify(wrongKind)).ok).toBe(false);

    const wrongVersion = { ...buildChartExport(chart), schemaVersion: 2 };
    expect(parseChartImport(JSON.stringify(wrongVersion)).ok).toBe(false);
  });

  it('rejects a chart with a structurally invalid shape (wrong pillar count)', () => {
    const envelope = buildChartExport(sampleChart());
    const corrupted = {
      ...envelope,
      chart: { ...envelope.chart, pillars: envelope.chart.pillars.slice(0, 7) },
    };
    expect(parseChartImport(JSON.stringify(corrupted)).ok).toBe(false);
  });

  it('rejects non-object top-level JSON (array, string, number, null)', () => {
    expect(parseChartImport(JSON.stringify([1, 2, 3])).ok).toBe(false);
    expect(parseChartImport(JSON.stringify('nope')).ok).toBe(false);
    expect(parseChartImport(JSON.stringify(42)).ok).toBe(false);
    expect(parseChartImport(JSON.stringify(null)).ok).toBe(false);
  });

  it('every rejection carries a non-empty, user-facing error string', () => {
    const bads = ['not json', '{}', '[]', JSON.stringify({ kind: CHART_EXPORT_KIND })];
    for (const raw of bads) {
      const result = parseChartImport(raw);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
    }
  });
});
