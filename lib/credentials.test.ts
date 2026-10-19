import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptCredential, encryptCredential, isCredentialEncryptionConfigured } from "./credentials";

vi.mock("server-only", () => ({}));

describe("profile credential encryption", () => {
  beforeEach(() => vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64")));
  afterEach(() => vi.unstubAllEnvs());

  it("round-trips credentials without storing plaintext and uses a fresh nonce", async () => {
    const first = await encryptCredential("test-api-key", "brewer", "openai");
    const second = await encryptCredential("test-api-key", "brewer", "openai");
    expect(first).not.toContain("test-api-key");
    expect(first).not.toBe(second);
    expect(await decryptCredential(first, "brewer", "openai")).toBe("test-api-key");
  });

  it("rejects ciphertext copied to another user or service", async () => {
    const encrypted = await encryptCredential("test-api-key", "brewer", "openai");
    await expect(decryptCredential(encrypted, "another-user", "openai")).rejects.toThrow();
    await expect(decryptCredential(encrypted, "brewer", "gemini")).rejects.toThrow();
  });

  it("rejects tampering and the wrong encryption key", async () => {
    const encrypted = await encryptCredential("test-api-key", "brewer", "brewfather");
    const [version, iv, data] = encrypted.split(".");
    const tampered = Buffer.from(data, "base64");
    tampered[0] ^= 1;
    await expect(decryptCredential(`${version}.${iv}.${tampered.toString("base64")}`, "brewer", "brewfather")).rejects.toThrow();
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", Buffer.alloc(32, 8).toString("base64"));
    await expect(decryptCredential(encrypted, "brewer", "brewfather")).rejects.toThrow();
  });

  it("fails closed when the dedicated encryption key is missing or invalid", async () => {
    for (const key of ["", "too-short", Buffer.alloc(16).toString("base64")]) {
      vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", key);
      expect(isCredentialEncryptionConfigured()).toBe(false);
      await expect(encryptCredential("test-api-key", "brewer", "openai")).rejects.toThrow("not configured");
    }
  });
});