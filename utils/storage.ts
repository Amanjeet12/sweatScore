import { MMKV } from 'react-native-mmkv';

type Listener = {
  remove: () => void;
};

type StoredValue = boolean | string | number | Uint8Array;

type SyncStorage = {
  set: (key: string, value: StoredValue) => void;
  getBoolean: (key: string) => boolean | undefined;
  getString: (key: string) => string | undefined;
  getNumber: (key: string) => number | undefined;
  getBuffer: (key: string) => Uint8Array | undefined;
  contains: (key: string) => boolean;
  delete: (key: string) => void;
  getAllKeys: () => string[];
  clearAll: () => void;
  recrypt: (key: string | undefined) => void;
  addOnValueChangedListener: (onValueChanged: (key: string) => void) => Listener;
};

class MemoryStorage implements SyncStorage {
  private values = new Map<string, StoredValue>();
  private listeners: ((key: string) => void)[] = [];

  private notify(key: string) {
    this.listeners.forEach((listener) => listener(key));
  }

  set(key: string, value: StoredValue) {
    this.values.set(key, value);
    this.notify(key);
  }

  getBoolean(key: string) {
    const value = this.values.get(key);
    return typeof value === 'boolean' ? value : undefined;
  }

  getString(key: string) {
    const value = this.values.get(key);
    return typeof value === 'string' ? value : undefined;
  }

  getNumber(key: string) {
    const value = this.values.get(key);
    return typeof value === 'number' ? value : undefined;
  }

  getBuffer(key: string) {
    const value = this.values.get(key);
    return value instanceof Uint8Array ? value : undefined;
  }

  contains(key: string) {
    return this.values.has(key);
  }

  delete(key: string) {
    this.values.delete(key);
    this.notify(key);
  }

  getAllKeys() {
    return Array.from(this.values.keys());
  }

  clearAll() {
    const keys = this.getAllKeys();
    this.values.clear();
    keys.forEach((key) => this.notify(key));
  }

  recrypt() {}

  addOnValueChangedListener(onValueChanged: (key: string) => void) {
    this.listeners.push(onValueChanged);

    return {
      remove: () => {
        this.listeners = this.listeners.filter((listener) => listener !== onValueChanged);
      },
    };
  }
}

const createStorage = (): SyncStorage => {
  try {
    return new MMKV();
  } catch (error) {
    if (__DEV__) {
      console.warn(
        'MMKV is unavailable. Falling back to in-memory storage for this session.',
        error
      );
    }

    return new MemoryStorage();
  }
};

export const storage = createStorage();

export const storeData = (key: string, value: any) => {
  try {
    const jsonValue = JSON.stringify(value);
    storage.set(key, jsonValue);
  } catch {
    // saving error
  }
};

export const getData = (key: string) => {
  try {
    const jsonValue = storage.getString(key);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch {
    // error reading value
    return undefined;
  }
};

export const removeData = (key: string) => {
  try {
    storage.delete(key);
    return true;
  } catch {
    return false;
  }
};
