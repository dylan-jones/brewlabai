import "server-only";
import { Buffer } from "node:buffer";

function encryptionKeyBytes() {
  const encoded = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!encoded || !/^[A-Za-z0-9+/]{43}=$/.test(encoded)) return null;
  const bytes = Uint8Array.from(Buffer.from(encoded, "base64"));
  return bytes.length === 32 ? bytes : null;
}

export function isCredentialEncryptionConfigured() {
  return encryptionKeyBytes() !== null;
}

async function encryptionKey() {
  const bytes = encryptionKeyBytes();
  if (!bytes) throw new Error("Credential encryption is not configured.");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptCredential(value: string, userId: string, service: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = new TextEncoder().encode(JSON.stringify([userId, service]));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData },
    await encryptionKey(),
    new TextEncoder().encode(value),
  );
  return `v1.${Buffer.from(iv).toString("base64")}.${Buffer.from(encrypted).toString("base64")}`;
}

export async function decryptCredential(value: string, userId: string, service: string) {
  const [version, encodedIv, encodedData, extra] = value.split(".");
  if (version !== "v1" || !encodedIv || !encodedData || extra !== undefined)
    throw new Error("Invalid encrypted credential.");
  const iv = Uint8Array.from(Buffer.from(encodedIv, "base64"));
  if (iv.length !== 12) throw new Error("Invalid encrypted credential.");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(JSON.stringify([userId, service])) },
    await encryptionKey(),
    Uint8Array.from(Buffer.from(encodedData, "base64")),
  );
  return new TextDecoder().decode(decrypted);
}