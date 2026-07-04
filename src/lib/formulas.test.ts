import { describe, expect, it } from "vitest";
import {
  ATFT_GAIN,
  DECAY,
  GRACE_FACTOR,
  ITFT_LOSS,
  SCALE,
  applySelfTrustEvent,
  clampSelfTrust,
  computeMomentum,
  displayedMomentum,
} from "./formulas";

describe("formula constants", () => {
  it("match the engineering-plan §4 values", () => {
    expect(ATFT_GAIN).toBe(4);
    expect(ITFT_LOSS).toBe(3);
    expect(GRACE_FACTOR).toBe(0.5);
    expect(DECAY).toBe(0.9);
    expect(SCALE).toBe(40);
  });
});

describe("applySelfTrustEvent", () => {
  it("gains taper toward the ceiling (ATFT at 50)", () => {
    // 50 + 4 * (1 - 0.5) = 52
    expect(applySelfTrustEvent(50, "ATFT")).toBeCloseTo(52);
  });

  it("losses are grace-factored and smaller than gains (ITFT at 50)", () => {
    // 50 - 3 * 0.5 * 0.5 = 49.25
    expect(applySelfTrustEvent(50, "ITFT")).toBeCloseTo(49.25);
  });

  it("stays within [0, 100]", () => {
    expect(applySelfTrustEvent(100, "ATFT")).toBeLessThanOrEqual(100);
    expect(applySelfTrustEvent(0, "ITFT")).toBeGreaterThanOrEqual(0);
    expect(applySelfTrustEvent(0, "ITFT")).toBe(0);
  });
});

describe("clampSelfTrust", () => {
  it("bounds to 0..100", () => {
    expect(clampSelfTrust(-5)).toBe(0);
    expect(clampSelfTrust(150)).toBe(100);
    expect(clampSelfTrust(42)).toBe(42);
  });
});

describe("computeMomentum", () => {
  it("folds activity into decayed previous momentum", () => {
    // 10 * 0.9 + 3 = 12
    expect(computeMomentum(10, 3)).toBeCloseTo(12);
  });

  it("a single inactive day never snaps to zero", () => {
    const next = computeMomentum(20, 0);
    expect(next).toBeCloseTo(18);
    expect(next).toBeGreaterThan(0);
  });
});

describe("displayedMomentum", () => {
  it("maps 0 to 0 and stays within [0, 100)", () => {
    expect(displayedMomentum(0)).toBe(0);
    expect(displayedMomentum(1000)).toBeLessThan(100);
    expect(displayedMomentum(1000)).toBeGreaterThan(90);
  });

  it("is monotonically increasing", () => {
    expect(displayedMomentum(10)).toBeLessThan(displayedMomentum(20));
  });
});
