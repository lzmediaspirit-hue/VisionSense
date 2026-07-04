import { beforeEach, describe, expect, it } from "vitest";
import {
  CURRENT_SCHEMA_VERSION,
  STORAGE_KEY,
  STORAGE_QUOTA_BYTES,
  computeStorageUsageBytes,
  createEmptyState,
  exportEnvelopeJSON,
  loadState,
  migrateData,
  parseImportedEnvelope,
  saveState,
  serializedByteLength,
  toEnvelope,
} from "./storage";

beforeEach(() => {
  localStorage.clear();
});

describe("createEmptyState", () => {
  it("starts Self-Trust neutral at 50 and momentum at 0", () => {
    const s = createEmptyState();
    expect(s.schemaVersion).toBe(1);
    expect(s.profileStats.selfTrust).toBe(50);
    expect(s.profileStats.momentumRaw).toBe(0);
    expect(s.profileStats.momentumDisplayed).toBe(0);
    expect(s.desiredRealities).toEqual([]);
    expect(s.selfTrustLedger).toEqual([]);
    expect(s.settings.languageMode).toBe("bookVocabulary");
  });
});

describe("envelope + persistence round-trip", () => {
  it("saveState writes the versioned envelope under vs_app_state", () => {
    const s = createEmptyState();
    saveState(s);
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(parsed.data.profileStats.selfTrust).toBe(50);
  });

  it("loadState reads back exactly what saveState wrote", () => {
    const s = createEmptyState();
    s.desiredRealities.push({
      id: "dr-1",
      title: "Steady work",
      targetFeeling: "secure",
      normalizeIt: true,
      createdAt: 123,
    });
    saveState(s);
    const loaded = loadState();
    expect(loaded).toEqual(s);
  });

  it("toEnvelope stamps the current schema version", () => {
    expect(toEnvelope(createEmptyState()).schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
  });
});

describe("loadState fail-soft behaviour", () => {
  it("returns a fresh state when nothing is stored", () => {
    expect(loadState().profileStats.selfTrust).toBe(50);
  });

  it("returns a fresh state on corrupt JSON without throwing", () => {
    localStorage.setItem(STORAGE_KEY, "{not valid json");
    expect(() => loadState()).not.toThrow();
    expect(loadState().desiredRealities).toEqual([]);
  });

  it("ignores an envelope from a newer, unknown schema version", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: 999, data: { foo: "bar" } })
    );
    expect(loadState().profileStats.selfTrust).toBe(50);
  });
});

describe("migration chain", () => {
  it("is a no-op at the current version", () => {
    const data = createEmptyState();
    expect(
      migrateData(data, CURRENT_SCHEMA_VERSION, CURRENT_SCHEMA_VERSION)
    ).toBe(data);
  });

  it("throws a clear error if a required migration is missing", () => {
    expect(() => migrateData({}, 1, 2)).toThrow(/migration/i);
  });
});

describe("export / import (M5)", () => {
  it("exportEnvelopeJSON round-trips through parseImportedEnvelope unchanged", () => {
    const s = createEmptyState();
    s.desiredRealities.push({
      id: "dr-1",
      title: "Steady work",
      targetFeeling: "secure",
      normalizeIt: true,
      createdAt: 123,
    });
    const json = exportEnvelopeJSON(s);
    expect(parseImportedEnvelope(json)).toEqual(s);
  });

  it("rejects text that isn't valid JSON", () => {
    expect(() => parseImportedEnvelope("{not valid")).toThrow();
  });

  it("rejects a JSON file that isn't a recognizable envelope", () => {
    expect(() => parseImportedEnvelope(JSON.stringify({ hello: "world" }))).toThrow();
  });

  it("rejects an envelope from a newer, unknown schema version", () => {
    expect(() =>
      parseImportedEnvelope(JSON.stringify({ schemaVersion: 999, data: {} }))
    ).toThrow();
  });

  it("rejects an envelope whose data is missing required arrays", () => {
    expect(() =>
      parseImportedEnvelope(
        JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, data: { foo: "bar" } })
      )
    ).toThrow();
  });
});

describe("storage usage monitor (M5)", () => {
  it("computes a positive byte size for a non-trivial state", () => {
    const s = createEmptyState();
    s.desiredRealities.push({
      id: "dr-1",
      title: "Steady work",
      targetFeeling: "secure",
      normalizeIt: true,
      createdAt: 123,
    });
    expect(computeStorageUsageBytes(s)).toBeGreaterThan(0);
  });

  it("grows as more data is added", () => {
    const empty = computeStorageUsageBytes(createEmptyState());
    const s = createEmptyState();
    for (let i = 0; i < 20; i++) {
      s.evidenceEntries.push({
        id: `e-${i}`,
        dateKey: "2026-01-01",
        createdAt: i,
        text: "A small win, logged for the storage-usage test",
        sourceType: "manualEntry",
      });
    }
    expect(computeStorageUsageBytes(s)).toBeGreaterThan(empty);
  });

  it("is a small fraction of the assumed ~5MB quota for a fresh state", () => {
    expect(computeStorageUsageBytes(createEmptyState()) / STORAGE_QUOTA_BYTES).toBeLessThan(0.01);
  });

  it("serializedByteLength counts unicode text by actual bytes, not JS string length", () => {
    // "é" is 1 JS string length unit but 2 UTF-8 bytes.
    expect(serializedByteLength("é")).toBe(2);
  });
});
