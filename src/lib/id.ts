import type { ID } from "../types";

/**
 * Native UUID for entity ids (no dependency). Single-device local storage has
 * no cross-client collision risk, so crypto.randomUUID() is ideal. Falls back
 * to a timestamp+random id only in the rare environment without it.
 */
export function newId(): ID {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
