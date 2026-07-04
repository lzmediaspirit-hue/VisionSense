import { beforeEach, describe, expect, it } from "vitest";
import {
  CURRENT_SCHEMA_VERSION,
  STORAGE_KEY,
  createEmptyState,
  loadState,
  migrateData,
  saveState,
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
