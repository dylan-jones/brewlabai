import { describe, expect, it } from "vitest";
import { checkOrigin, readJSON } from "./api";

describe("API boundaries", () => {
  it("rejects cross-site mutations and accepts same-origin requests", () => {
    expect(() =>
      checkOrigin(
        new Request("https://brew.example/api/ai", {
          headers: { origin: "https://attacker.example" },
        }),
      ),
    ).toThrow("originate");
    expect(() =>
      checkOrigin(
        new Request("https://brew.example/api/ai", {
          headers: { origin: "https://brew.example" },
        }),
      ),
    ).not.toThrow();
  });
  it("parses bounded JSON and rejects oversized bodies without Content-Length", async () => {
    const request = (body: string) =>
      new Request("https://brew.example", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    await expect(readJSON(request('{"ok":true}'))).resolves.toEqual({
      ok: true,
    });
    await expect(readJSON(request('{"text":"too large"}'), 5)).rejects.toThrow(
      "large",
    );
    await expect(readJSON(request("{oops}"))).rejects.toThrow("Invalid JSON");
  });
});
