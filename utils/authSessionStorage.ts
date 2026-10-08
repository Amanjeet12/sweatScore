import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { createAuthSessionStorage } from '~/shared/authSessionStorage';

const memory = new Map<string, string>();
const browserStorage = {
  getItem: (key: string) =>
    typeof localStorage === 'undefined' ? (memory.get(key) ?? null) : localStorage.getItem(key),
  setItem: (key: string, value: string) => {
    if (typeof localStorage === 'undefined') memory.set(key, value);
    else localStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (typeof localStorage === 'undefined') memory.delete(key);
    else localStorage.removeItem(key);
  },
};

export const authSessionStorage = createAuthSessionStorage(
  Platform.OS === 'ios' || Platform.OS === 'android'
    ? {
        getItem: SecureStore.getItemAsync,
        setItem: SecureStore.setItemAsync,
        removeItem: SecureStore.deleteItemAsync,
      }
    : browserStorage,
  process.env.EXPO_PUBLIC_CONVEX_URL!
);