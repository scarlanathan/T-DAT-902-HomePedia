import { vi } from "vitest";

/** Shared router mock; `vitest.setup.tsx` wires `useRouter` to this object. */
export const mockRouter = {
  replace: vi.fn(),
  push: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
};

/** Default `/`; override with `mockReturnValue` in tests (e.g. `/login`). */
export const mockPathname = vi.fn(() => "/");
