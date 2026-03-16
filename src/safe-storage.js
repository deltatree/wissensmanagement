class SafeStorageAdapter {
  constructor(persistentStorage) {
    this.persistentStorage = persistentStorage;
    this.memory = new Map();
  }

  getItem(key) {
    const storageKey = String(key);

    if (this.persistentStorage) {
      try {
        const value = this.persistentStorage.getItem(storageKey);
        if (value !== null && value !== undefined) {
          return value;
        }
      } catch {
        // ignore and fallback to memory storage
      }
    }

    return this.memory.has(storageKey) ? this.memory.get(storageKey) : null;
  }

  setItem(key, value) {
    const storageKey = String(key);
    const storageValue = String(value);

    if (this.persistentStorage) {
      try {
        this.persistentStorage.setItem(storageKey, storageValue);
        this.memory.delete(storageKey);
        return;
      } catch {
        // ignore and fallback to memory storage
      }
    }

    this.memory.set(storageKey, storageValue);
  }

  removeItem(key) {
    const storageKey = String(key);

    if (this.persistentStorage) {
      try {
        this.persistentStorage.removeItem(storageKey);
      } catch {
        // ignore and continue with memory storage
      }
    }

    this.memory.delete(storageKey);
  }
}

function resolveBrowserLocalStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storage = window.localStorage;
    const probeKey = "__km_storage_probe__";
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return null;
  }
}

export function createSafeStorage() {
  const persistentStorage = resolveBrowserLocalStorage();
  return {
    storage: new SafeStorageAdapter(persistentStorage),
    persistent: Boolean(persistentStorage)
  };
}
