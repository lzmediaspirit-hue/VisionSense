// Unit coverage for the pure helpers exported from controller.tsx. The
// controller component itself needs a full GIS/Drive mock harness (React
// effects, timers, fetch) that the orchestrator's browser QA covers
// separately — this file only exercises the deterministic, side-effect-free
// pieces.

import { describe, expect, it } from 'vitest';
import { canonicalFile } from './controller';
import type { DriveFileRef } from './drive';

function ref(id: string, createdTime: string): DriveFileRef {
  return { id, createdTime };
}

describe('canonicalFile (SPEC 20 duplicate-file reconciliation)', () => {
  it('picks the oldest createdTime', () => {
    const files = [
      ref('b', '2026-02-01T00:00:00.000Z'),
      ref('a', '2026-01-01T00:00:00.000Z'),
      ref('c', '2026-03-01T00:00:00.000Z'),
    ];
    expect(canonicalFile(files).id).toBe('a');
  });

  it('breaks a createdTime tie with the lexicographically smaller id', () => {
    const files = [ref('zzz', '2026-01-01T00:00:00.000Z'), ref('aaa', '2026-01-01T00:00:00.000Z')];
    expect(canonicalFile(files).id).toBe('aaa');
  });

  it('is order-independent (same input set, different array order, same result)', () => {
    const a = ref('a', '2026-01-01T00:00:00.000Z');
    const b = ref('b', '2026-01-02T00:00:00.000Z');
    const c = ref('c', '2026-01-03T00:00:00.000Z');
    expect(canonicalFile([a, b, c]).id).toBe('a');
    expect(canonicalFile([c, b, a]).id).toBe('a');
    expect(canonicalFile([b, a, c]).id).toBe('a');
  });

  it('handles a single file', () => {
    expect(canonicalFile([ref('only', '2026-01-01T00:00:00.000Z')]).id).toBe('only');
  });
});
