// Unit tests for the v1.4 journal merge (SPEC 11.4): per-key LWW union over
// day plans and weekly reviews, mirroring sync/merge.test.ts's style.

import { describe, expect, it } from 'vitest';
import type { DayPlan, Review } from '../model/types';
import { mergeJournals, type Journal } from './journalMerge';

function day(note: string, updatedAt: string): DayPlan {
  return { mits: [], note, updatedAt };
}

function review(wins: string, updatedAt: string): Review {
  return { wins, obstacle: '', change: '', focus: '', updatedAt };
}

function journal(days: Record<string, DayPlan> = {}, reviews: Record<string, Review> = {}): Journal {
  return { days, reviews };
}

describe('mergeJournals', () => {
  it('unions day plans and reviews present on only one side', () => {
    const local = journal({ '2026-07-10': day('local', '2026-07-10T00:00:00.000Z') });
    const remote = journal(
      {},
      { '2026-W28': review('remote', '2026-07-10T00:00:00.000Z') },
    );
    const merged = mergeJournals(local, remote);
    expect(Object.keys(merged.days)).toEqual(['2026-07-10']);
    expect(Object.keys(merged.reviews)).toEqual(['2026-W28']);
  });

  it('LWW: remote strictly newer overwrites local (days)', () => {
    const local = journal({ '2026-07-10': day('old', '2026-07-10T00:00:00.000Z') });
    const remote = journal({ '2026-07-10': day('new', '2026-07-11T00:00:00.000Z') });
    const merged = mergeJournals(local, remote);
    expect(merged.days['2026-07-10'].note).toBe('new');
  });

  it('LWW: local strictly newer beats remote (days)', () => {
    const local = journal({ '2026-07-10': day('newer', '2026-07-12T00:00:00.000Z') });
    const remote = journal({ '2026-07-10': day('older', '2026-07-11T00:00:00.000Z') });
    const merged = mergeJournals(local, remote);
    expect(merged.days['2026-07-10'].note).toBe('newer');
  });

  it('LWW: remote strictly newer overwrites local (reviews)', () => {
    const local = journal({}, { '2026-W28': review('old', '2026-07-10T00:00:00.000Z') });
    const remote = journal({}, { '2026-W28': review('new', '2026-07-11T00:00:00.000Z') });
    const merged = mergeJournals(local, remote);
    expect(merged.reviews['2026-W28'].wins).toBe('new');
  });

  it('LWW: local strictly newer beats remote (reviews)', () => {
    const local = journal({}, { '2026-W28': review('newer', '2026-07-12T00:00:00.000Z') });
    const remote = journal({}, { '2026-W28': review('older', '2026-07-11T00:00:00.000Z') });
    const merged = mergeJournals(local, remote);
    expect(merged.reviews['2026-W28'].wins).toBe('newer');
  });

  it('a tie on updatedAt keeps local (matches mergeSides semantics)', () => {
    const local = journal({ '2026-07-10': day('local', '2026-07-10T00:00:00.000Z') });
    const remote = journal({ '2026-07-10': day('remote', '2026-07-10T00:00:00.000Z') });
    const merged = mergeJournals(local, remote);
    expect(merged.days['2026-07-10'].note).toBe('local');
  });

  it('unparseable updatedAt is treated as oldest (epoch 0), so a valid timestamp wins', () => {
    const local = journal({ '2026-07-10': day('local-bad', 'not-a-date') });
    const remote = journal({ '2026-07-10': day('remote-valid', '2026-07-10T00:00:00.000Z') });
    const merged = mergeJournals(local, remote);
    expect(merged.days['2026-07-10'].note).toBe('remote-valid');
  });

  it('is idempotent: merging the result with itself is stable', () => {
    const local = journal(
      { '2026-07-10': day('a', '2026-07-10T00:00:00.000Z') },
      { '2026-W28': review('b', '2026-07-10T00:00:00.000Z') },
    );
    const remote = journal(
      { '2026-07-11': day('c', '2026-07-11T00:00:00.000Z') },
      { '2026-W29': review('d', '2026-07-11T00:00:00.000Z') },
    );
    const first = mergeJournals(local, remote);
    const second = mergeJournals(first, first);
    expect(second).toEqual(first);
  });

  it('does not mutate the input records', () => {
    const localDays = { '2026-07-10': day('local', '2026-07-10T00:00:00.000Z') };
    const local = journal(localDays);
    const remote = journal({ '2026-07-10': day('remote', '2026-07-11T00:00:00.000Z') });
    mergeJournals(local, remote);
    expect(localDays['2026-07-10'].note).toBe('local');
  });
});
