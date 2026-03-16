import { createDefaultState, mapLegacyPrototypeState, mergeWithDefaults } from "./state.js";

const STORAGE_KEY = "km-app-secure-v2";
const LEGACY_ENCRYPTED_KEYS = ["azure-openai-prototype-secure-v1"];
const LEGACY_PLAIN_KEYS = ["azure-openai-prototype-config-v1"];
const PBKDF2_ITERATIONS = 250000;

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveAesKey(password, saltBytes) {
  const passwordBytes = new TextEncoder().encode(password);
  const baseKey = await crypto.subtle.importKey(
    "raw",
    passwordBytes,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptJson(payload, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt);
  const plaintextBytes = new TextEncoder().encode(JSON.stringify(payload));

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintextBytes
  );

  return {
    v: 2,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(encryptedBuffer))
  };
}

async function decryptJson(payload, password) {
  if (!payload || typeof payload !== "object" || !payload.salt || !payload.iv || !payload.data) {
    throw new Error("Ungueltiges verschluesseltes Format.");
  }

  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const encryptedBytes = base64ToBytes(payload.data);
  const key = await deriveAesKey(password, salt);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encryptedBytes
  );

  const decryptedText = new TextDecoder().decode(decryptedBuffer);
  return JSON.parse(decryptedText);
}

function hasKey(storage, key) {
  return Boolean(storage.getItem(key));
}

export class EncryptedStore {
  constructor(storage = window.localStorage) {
    this.storage = storage;
  }

  hasAnyState() {
    if (hasKey(this.storage, STORAGE_KEY)) {
      return true;
    }

    for (const key of LEGACY_ENCRYPTED_KEYS) {
      if (hasKey(this.storage, key)) {
        return true;
      }
    }

    for (const key of LEGACY_PLAIN_KEYS) {
      if (hasKey(this.storage, key)) {
        return true;
      }
    }

    return false;
  }

  async save(state, password) {
    const encrypted = await encryptJson(mergeWithDefaults(state), password);
    this.storage.setItem(STORAGE_KEY, JSON.stringify(encrypted));
  }

  async load(password) {
    if (hasKey(this.storage, STORAGE_KEY)) {
      const payload = JSON.parse(this.storage.getItem(STORAGE_KEY) || "{}");
      return mergeWithDefaults(await decryptJson(payload, password));
    }

    for (const key of LEGACY_ENCRYPTED_KEYS) {
      if (!hasKey(this.storage, key)) {
        continue;
      }

      const payload = JSON.parse(this.storage.getItem(key) || "{}");
      const decrypted = await decryptJson(payload, password);
      const migrated = mergeWithDefaults(this.migrateLegacy(decrypted));
      await this.save(migrated, password);
      this.storage.removeItem(key);
      return migrated;
    }

    for (const key of LEGACY_PLAIN_KEYS) {
      if (!hasKey(this.storage, key)) {
        continue;
      }

      const parsed = JSON.parse(this.storage.getItem(key) || "{}");
      const migrated = mergeWithDefaults(mapLegacyPrototypeState(parsed));
      await this.save(migrated, password);
      this.storage.removeItem(key);
      return migrated;
    }

    return createDefaultState();
  }

  clearAll() {
    this.storage.removeItem(STORAGE_KEY);
    for (const key of LEGACY_ENCRYPTED_KEYS) {
      this.storage.removeItem(key);
    }
    for (const key of LEGACY_PLAIN_KEYS) {
      this.storage.removeItem(key);
    }
  }

  migrateLegacy(decrypted) {
    if (decrypted && typeof decrypted === "object" && decrypted.version >= 2) {
      return decrypted;
    }

    return mapLegacyPrototypeState(decrypted);
  }
}
