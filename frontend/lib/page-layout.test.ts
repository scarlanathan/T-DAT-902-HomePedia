import { describe, expect, it } from "vitest";
import { APP_PAGE_SHELL_CLASS } from "./page-layout";

describe("page-layout", () => {
  it("exports app page shell class", () => {
    expect(APP_PAGE_SHELL_CLASS).toBe("hp-page-shell");
  });
});
