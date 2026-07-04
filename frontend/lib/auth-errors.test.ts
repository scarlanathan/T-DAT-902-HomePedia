import { describe, expect, it } from "vitest";
import { authErrorKey } from "./auth-errors";

describe("authErrorKey", () => {
  it("maps known API messages to i18n keys", () => {
    expect(authErrorKey("Invalid email or password")).toBe("auth.invalidCredentials");
    expect(authErrorKey("Email already registered")).toBe("auth.emailAlreadyRegistered");
    expect(authErrorKey("Invalid request body")).toBe("auth.invalidRequest");
  });

  it("falls back to generic auth error", () => {
    expect(authErrorKey("Something unexpected")).toBe("auth.errorGeneric");
  });
});
