import { describe, expect, it } from 'vitest';
import { createChart } from './factory';
import {
  buildChartExport,
  CHART_EXPORT_KIND,
  CHART_EXPORT_VERSION,
  parseChartImport,
  serializeChartExport,
} from './exportImport';
import {
  cycleActionStatus,
  renamePillar,
  setActionHabit,
  setActionText,
  toggleHabitToday,
} from './operations';

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

  it('imports a pre-v1.1 export file (actions lacking the new fields), defaulting them', () => {
    // Hand-write an OLD export envelope: valid v1.0 shape, but its actions have
    // no description/reward/completedAt. It must import cleanly (SPEC 7.4).
    const chart = sampleChart();
    const legacyEnvelope = {
      kind: CHART_EXPORT_KIND,
      schemaVersion: CHART_EXPORT_VERSION,
      exportedAt: '2023-06-01T00:00:00.000Z',
      chart: {
        ...chart,
        pillars: chart.pillars.map((p) => ({
          ...p,
          actions: p.actions.map((a) => ({ id: a.id, text: a.text, status: a.status })),
        })),
      },
    };
    const result = parseChartImport(JSON.stringify(legacyEnvelope));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const pillar of result.chart.pillars) {
      for (const action of pillar.actions) {
        expect(action.description).toBe('');
        expect(action.reward).toBe('');
        expect(action.completedAt).toBeNull();
      }
    }
  });

  it('round-trips the v1.2 habit fields through export -> import', () => {
    let chart = setActionText(sampleChart(), 1, 0, 'Meditate', () => '2024-01-01T00:00:00.000Z');
    chart = setActionHabit(chart, 1, 0, true, () => '2024-01-02T00:00:00.000Z');
    chart = toggleHabitToday(chart, 1, 0, () => '2024-01-03T08:00:00.000Z');
    const json = serializeChartExport(chart);
    expect(json).toContain('habit');
    expect(json).toContain('established');
    expect(json).toContain('completions');
    const result = parseChartImport(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const action = result.chart.pillars[1].actions[0];
    expect(action.habit).toBe(true);
    expect(action.completions).toEqual(['2024-01-03T08:00:00.000Z']);
  });

  it('imports a pre-v1.2 export file (actions lacking habit fields), defaulting them', () => {
    const chart = sampleChart();
    const legacyEnvelope = {
      kind: CHART_EXPORT_KIND,
      schemaVersion: CHART_EXPORT_VERSION,
      exportedAt: '2023-06-01T00:00:00.000Z',
      chart: {
        ...chart,
        pillars: chart.pillars.map((p) => ({
          ...p,
          actions: p.actions.map((a) => ({
            id: a.id,
            text: a.text,
            status: a.status,
            description: a.description,
            reward: a.reward,
            completedAt: a.completedAt,
          })),
        })),
      },
    };
    const result = parseChartImport(JSON.stringify(legacyEnvelope));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const pillar of result.chart.pillars) {
      for (const action of pillar.actions) {
        expect(action.habit).toBe(false);
        expect(action.established).toBe(false);
        expect(action.completions).toEqual([]);
      }
    }
  });

  it('round-trips the v1.1 fields through export -> import', () => {
    const chart = sampleChart();
    const json = serializeChartExport(chart);
    // The serialized JSON literally contains the new keys.
    expect(json).toContain('completedAt');
    expect(json).toContain('description');
    expect(json).toContain('reward');
    const result = parseChartImport(json);
    expect(result.ok).toBe(true);
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
