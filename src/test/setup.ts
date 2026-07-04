import "@testing-library/jest-dom/vitest";

// Ensure each test starts from a clean localStorage so the persisted
// Zustand envelope from one test never leaks into the next.
afterEach(() => {
  localStorage.clear();
});
