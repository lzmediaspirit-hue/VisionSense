import type { AppStateV1, ProfileStats, Settings, StorageEnvelope } from "../types";
import { todayKey } from "./dates";

/** The single localStorage key holding the whole versioned envelope. */
export const STORAGE_KEY = "vs_app_state";
/** Prefix for pre-migration backups (kept one prior version only). */
export const BACKUP_KEY_PREFIX = "vs_app_state_backup_v";

/** Current app schema version. Bump when adding a migration below. */
export const CURRENT_SCHEMA_VERSION = 1;

const DEFAULT_SETTINGS: Settings = {
  languageMode: "bookVocabulary",
  relaxGateEnabled: true,
  remindersEnabled: false,
};

/** A fresh, empty AppStateV1. Self-Trust starts neutral at 50; momentum at 0. */
export function createEmptyState(now: Date = new Date()): AppStateV1 {
  const profileStats: ProfileStats = {
    selfTrust: 50,
    momentumRaw: 0,
    momentumDisplayed: 0,
    lastComputedDateKey: todayKey(now),
  };
  return {
    schemaVersion: 1,
    desiredRealities: [],
    habits: [],
    checkIns: [],
    habitCompletions: [],
    exerciseSessions: [],
    mentalNudges: [],
    evidenceEntries: [],
    selfTrustLedger: [],
    putOffItems: [],
    profileStats,
    settings: { ...DEFAULT_SETTINGS },
  };
}

/**
 * Ordered migration chain. `migrations[v]` upgrades data FROM version `v` to
 * version `v + 1`. Each function is pure and independently unit-tested. There
 * are no migrations yet (v1 is current), but the machinery is wired so future
 * versions only add an entry here.
 */
type MigrationFn = (oldData: unknown) => unknown;
export const migrations: Record<number, MigrationFn> = {
  // 1: (old) => upgradeV1toV2(old),
};

/**
 * Run the migration chain from an envelope's stored version up to
 * CURRENT_SCHEMA_VERSION. Returns the upgraded data. Before running any
 * migration, callers should back up (see loadState).
 */
export function migrateData(
  data: unknown,
  fromVersion: number,
  toVersion: number = CURRENT_SCHEMA_VERSION
): unknown {
  let current = data;
  for (let v = fromVersion; v < toVersion; v++) {
    const migrate = migrations[v];
    if (!migrate) {
      throw new Error(
        `Missing migration from schema version ${v} to ${v + 1}`
      );
    }
    current = migrate(current);
  }
  return current;
}

/**
 * Wrap AppStateV1 in the versioned storage envelope.
 */
export function toEnvelope(data: AppStateV1): StorageEnvelope {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, data };
}

/**
 * Read + parse + migrate the persisted state. Returns a fresh empty state when
 * nothing is stored or the stored blob is unreadable (fail-soft: never throw
 * into app boot over a corrupt/absent value).
 */
export function loadState(now: Date = new Date()): AppStateV1 {
  const raw = safeGetItem(STORAGE_KEY);
  if (raw == null) return createEmptyState(now);

  let envelope: StorageEnvelope;
  try {
    envelope = JSON.parse(raw) as StorageEnvelope;
  } catch {
    // Corrupt JSON — do not clobber it silently; start fresh in memory.
    return createEmptyState(now);
  }

  if (
    typeof envelope !== "object" ||
    envelope == null ||
    typeof envelope.schemaVersion !== "number"
  ) {
    return createEmptyState(now);
  }

  if (envelope.schemaVersion === CURRENT_SCHEMA_VERSION) {
    return envelope.data;
  }

  if (envelope.schemaVersion < CURRENT_SCHEMA_VERSION) {
    // Back up the pre-migration copy for one prior version, then migrate.
    safeSetItem(
      `${BACKUP_KEY_PREFIX}${envelope.schemaVersion}`,
      raw
    );
    const migrated = migrateData(
      envelope.data,
      envelope.schemaVersion,
      CURRENT_SCHEMA_VERSION
    ) as AppStateV1;
    return migrated;
  }

  // Stored version is newer than this build knows about — start fresh in
  // memory rather than risk misreading a future shape.
  return createEmptyState(now);
}

/** Serialize + persist the whole state under the versioned envelope. */
export function saveState(data: AppStateV1): void {
  safeSetItem(STORAGE_KEY, JSON.stringify(toEnvelope(data)));
}

// --- localStorage guards (private browsing / quota / SSR safety) ---

function safeGetItem(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Quota exceeded or storage unavailable — swallow; a storage monitor
    // (later milestone) surfaces this to the user rather than crashing writes.
  }
}
