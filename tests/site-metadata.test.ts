import { describe, expect, it } from "vitest";
import { publicSiteOrigin } from "../src/lib/site-metadata";

describe("public site metadata", () => {
  it("uses the configured HTTPS origin without inventing a hostname", () => {
    expect(publicSiteOrigin("https://finance.example.com/")).toBe("https://finance.example.com");
  });
  it.each(["", "not a URL", "http://finance.example.com", "https://user:secret@finance.example.com", "https://finance.example.com/path", "https://finance.example.com/?secret=abc", "https://finance.example.com/#token", "http://localhost:3000", "https://localhost", "https://127.0.0.1:3000", "https://[::1]:3000", "https://preview.localhost"]) ("does not advertise an unsafe or local origin: %s", value => {
    expect(publicSiteOrigin(value)).toBeNull();
  });
});
