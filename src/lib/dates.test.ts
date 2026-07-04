import { describe, expect, it } from "vitest";
import { toLocalDateKey, todayKey } from "./dates";

// These tests run under TZ=America/New_York (set in vite.config.ts) so that
// DST transitions and the west-of-UTC midnight case are exercised for real.

describe("toLocalDateKey", () => {
  it("formats local calendar fields as YYYY-MM-DD (zero-padded)", () => {
    // 2023-03-05 09:07 local
    expect(toLocalDateKey(new Date(2023, 2, 5, 9, 7))).toBe("2023-03-05");
  });

  it("uses the LOCAL day near midnight, not the UTC day (no toISOString)", () => {
    // 11:30pm local on 2023-03-11. In New York (UTC-5) this is 04:30 UTC on
    // 2023-03-12 — so toISOString() would misfile it onto the 12th.
    const d = new Date(2023, 2, 11, 23, 30);
    expect(toLocalDateKey(d)).toBe("2023-03-11");
    // Prove the pitfall we are avoiding: UTC really is the next day here.
    expect(d.toISOString().slice(0, 10)).toBe("2023-03-12");
  });

  it("handles the DST spring-forward day (clocks jump 02:00 -> 03:00)", () => {
    // 2023-03-12 is spring-forward in the US. A time after the gap.
    expect(toLocalDateKey(new Date(2023, 2, 12, 6, 0))).toBe("2023-03-12");
    // Just before the transition, still the 12th.
    expect(toLocalDateKey(new Date(2023, 2, 12, 1, 30))).toBe("2023-03-12");
  });

  it("handles the DST fall-back day (clocks repeat 01:00-02:00)", () => {
    // 2023-11-05 is fall-back in the US; 01:30 is ambiguous but the date key
    // must remain the 5th regardless of which offset the clock resolves to.
    expect(toLocalDateKey(new Date(2023, 10, 5, 1, 30))).toBe("2023-11-05");
    expect(toLocalDateKey(new Date(2023, 10, 5, 23, 59))).toBe("2023-11-05");
  });

  it("pads single-digit months and days", () => {
    expect(toLocalDateKey(new Date(2024, 0, 1, 0, 0))).toBe("2024-01-01");
    expect(toLocalDateKey(new Date(2024, 8, 9, 12, 0))).toBe("2024-09-09");
  });

  it("todayKey delegates to toLocalDateKey", () => {
    const now = new Date(2025, 5, 30, 8, 0);
    expect(todayKey(now)).toBe(toLocalDateKey(now));
  });
});
