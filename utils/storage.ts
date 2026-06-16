import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV();

export const storeData = (key: string, value: any) => {
  try {
    const jsonValue = JSON.stringify(value);
    storage.set(key, jsonValue);
  } catch (e) {
    // saving error
  }
};

export const getData = (key: string) => {
  try {
    const jsonValue = storage.getString(key);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    // error reading value
    return undefined;
  }
};

export const removeData = (key: string) => {
  try {
    storage.delete(key);
    return true;
  } catch (e) {
    return false;
  }
};
