// Unit tests for the Drive fetch wrapper (SPEC 20 duplicate-file
// reconciliation additions). The token is injected and `fetch` is a global,
// so this layer is mockable by stubbing it directly (see drive.ts's own
// module comment).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteFile, DriveError, findFile, listFiles } from './drive';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listFiles', () => {
  it('returns every matching file with id + createdTime', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        files: [
          { id: 'a', name: 'visionsense.json', createdTime: '2026-01-01T00:00:00.000Z' },
          { id: 'b', name: 'visionsense.json', createdTime: '2026-02-01T00:00:00.000Z' },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const files = await listFiles('tok');
    expect(files).toEqual([
      { id: 'a', createdTime: '2026-01-01T00:00:00.000Z' },
      { id: 'b', createdTime: '2026-02-01T00:00:00.000Z' },
    ]);
    // Queries by name in appDataFolder, and requests createdTime specifically
    // (needed for canonical-file selection), not just modifiedTime.
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('spaces=appDataFolder');
    expect(url).toContain('createdTime');
  });

  it('returns an empty array when no files match', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ files: [] })));
    expect(await listFiles('tok')).toEqual([]);
  });

  it('drops malformed entries missing id or createdTime', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          files: [{ id: 'ok', createdTime: '2026-01-01T00:00:00.000Z' }, { id: 'no-time' }, {}],
        }),
      ),
    );
    expect(await listFiles('tok')).toEqual([{ id: 'ok', createdTime: '2026-01-01T00:00:00.000Z' }]);
  });

  it('throws a DriveError on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 403)));
    await expect(listFiles('tok')).rejects.toBeInstanceOf(DriveError);
  });
});

describe('findFile (single-file compatibility wrapper over listFiles)', () => {
  it('returns the id of the first match', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          files: [
            { id: 'first', createdTime: '2026-01-01T00:00:00.000Z' },
            { id: 'second', createdTime: '2026-02-01T00:00:00.000Z' },
          ],
        }),
      ),
    );
    expect(await findFile('tok')).toBe('first');
  });

  it('returns null when nothing matches', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ files: [] })));
    expect(await findFile('tok')).toBeNull();
  });
});

describe('deleteFile', () => {
  it('issues a DELETE against the file id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    await deleteFile('tok', 'file-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/files/file-1');
    expect(init.method).toBe('DELETE');
  });

  it('treats a 404 as success (already gone)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(deleteFile('tok', 'gone')).resolves.toBeUndefined();
  });

  it('throws a DriveError on other failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })));
    await expect(deleteFile('tok', 'x')).rejects.toBeInstanceOf(DriveError);
  });
});
