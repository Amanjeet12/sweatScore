import { MMKV } from 'react-native-mmkv';

type StorageValue = boolean | string | number | Uint8Array;
type Storage = Pick<
  MMKV,
  | 'clearAll'
  | 'contains'
  | 'delete'
  | 'getAllKeys'
  | 'getBoolean'
  | 'getBuffer'
  | 'getNumber'
  | 'getString'
  | 'recrypt'
  | 'set'
>;

const createMemoryStorage = (): Storage => {
  const values = new Map<string, StorageValue>();

  return {
    set: (key, value) => {
      values.set(key, value);
    },
    getBoolean: (key) => {
      const value = values.get(key);
      if (typeof value === 'boolean') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      return undefined;
    },
    getString: (key) => {
      const value = values.get(key);
      if (value == null) return undefined;
      if (value instanceof Uint8Array) return undefined;
      return String(value);
    },
    getNumber: (key) => {
      const value = values.get(key);
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const numberValue = Number(value);
        return Number.isNaN(numberValue) ? undefined : numberValue;
      }
      return undefined;
    },
    getBuffer: (key) => {
      const value = values.get(key);
      return value instanceof Uint8Array ? value : undefined;
    },
    contains: (key) => values.has(key),
    delete: (key) => {
      values.delete(key);
    },
    getAllKeys: () => Array.from(values.keys()),
    clearAll: () => {
      values.clear();
    },
    recrypt: () => {},
  };
};

const createStorage = (): Storage => {
  try {
    return new MMKV();
  } catch (error) {
    console.warn('MMKV unavailable, using in-memory storage fallback.', error);
    return createMemoryStorage();
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
