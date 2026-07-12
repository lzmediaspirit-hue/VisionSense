// Thin fetch wrapper over the Google Drive REST v3 API, scoped to the hidden
// per-app folder `appDataFolder` (SPEC 10.3). The single file we manage is
// `visionsense.json`. The access token is passed IN (never read from a global)
// so this whole layer is trivially mockable in unit tests and browser QA by
// stubbing `global.fetch`.

import type { Chart } from '../model/types';

const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const USERINFO = 'https://www.googleapis.com/oauth2/v3/userinfo';

export const DRIVE_FILE_NAME = 'visionsense.json';

/** Shape of the JSON blob stored in Drive (validated with defaults on read). */
export interface DrivePayload {
  schemaVersion: 1;
  charts: Chart[];
  deletedChartIds: Record<string, string>;
  savedAt: string; // ISO
}

/** An HTTP-level Drive failure. `status` lets callers detect auth (401) vs. other. */
export class DriveError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'DriveError';
  }
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function toDriveError(res: Response): Promise<DriveError> {
  let detail = '';
  try {
    detail = await res.text();
  } catch {
    // ignore
  }
  return new DriveError(res.status, `Drive request failed (${res.status}). ${detail}`.trim());
}

/** Look up the id of `visionsense.json` in appDataFolder, or null if absent. */
export async function findFile(token: string): Promise<string | null> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name = '${DRIVE_FILE_NAME}' and trashed = false`,
    fields: 'files(id,name,modifiedTime)',
    pageSize: '10',
  });
  const res = await fetch(`${DRIVE_FILES}?${params.toString()}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw await toDriveError(res);
  const data: unknown = await res.json();
  const files =
    typeof data === 'object' && data !== null && Array.isArray((data as { files?: unknown }).files)
      ? ((data as { files: Array<{ id?: unknown }> }).files ?? [])
      : [];
  const first = files[0];
  return first && typeof first.id === 'string' ? first.id : null;
}

/** Download and JSON-parse the media body of a Drive file. */
export async function downloadFile(token: string, fileId: string): Promise<unknown> {
  const res = await fetch(`${DRIVE_FILES}/${encodeURIComponent(fileId)}?alt=media`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw await toDriveError(res);
  return res.json();
}

const BOUNDARY = 'visionsense-boundary-7f3a9c';

function multipartBody(metadata: Record<string, unknown>, payload: DrivePayload): string {
  return [
    `--${BOUNDARY}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${BOUNDARY}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(payload),
    `--${BOUNDARY}--`,
    '',
  ].join('\r\n');
}

/** Create `visionsense.json` in appDataFolder via a multipart upload. Returns its id. */
export async function createFile(token: string, payload: DrivePayload): Promise<string> {
  const body = multipartBody({ name: DRIVE_FILE_NAME, parents: ['appDataFolder'] }, payload);
  const res = await fetch(`${DRIVE_UPLOAD}?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': `multipart/related; boundary=${BOUNDARY}`,
    },
    body,
  });
  if (!res.ok) throw await toDriveError(res);
  const data: unknown = await res.json();
  const id = typeof data === 'object' && data !== null ? (data as { id?: unknown }).id : undefined;
  if (typeof id !== 'string') throw new DriveError(res.status, 'Drive create returned no file id.');
  return id;
}

/** Overwrite an existing `visionsense.json` via a multipart update. */
export async function updateFile(
  token: string,
  fileId: string,
  payload: DrivePayload,
): Promise<void> {
  // Metadata part carries no `parents` on update (that is create-only).
  const body = multipartBody({ name: DRIVE_FILE_NAME }, payload);
  const res = await fetch(
    `${DRIVE_UPLOAD}/${encodeURIComponent(fileId)}?uploadType=multipart`,
    {
      method: 'PATCH',
      headers: {
        ...authHeaders(token),
        'Content-Type': `multipart/related; boundary=${BOUNDARY}`,
      },
      body,
    },
  );
  if (!res.ok) throw await toDriveError(res);
}

/** Fetch the signed-in user's email via the OpenID userinfo endpoint. */
export async function fetchUserEmail(token: string): Promise<string> {
  const res = await fetch(USERINFO, { headers: authHeaders(token) });
  if (!res.ok) throw await toDriveError(res);
  const data: unknown = await res.json();
  const email =
    typeof data === 'object' && data !== null ? (data as { email?: unknown }).email : undefined;
  return typeof email === 'string' ? email : '';
}
