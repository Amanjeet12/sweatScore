import * as ImagePicker from 'expo-image-picker';
import type { PermissionResponse } from 'expo-modules-core';
import { Alert, Linking } from 'react-native';

type RuntimePermissionOptions = {
  current: PermissionResponse | null | undefined;
  request: () => Promise<PermissionResponse>;
  name: 'Camera' | 'Microphone';
  purpose: string;
};

function showPermissionSettingsAlert(name: RuntimePermissionOptions['name'], purpose: string) {
  Alert.alert(
    `${name} access required`,
    `${purpose} Enable ${name.toLowerCase()} access for SweatScore in your device settings.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => {
          Linking.openSettings().catch((error) => {
            console.warn('Unable to open app settings:', error);
          });
        },
      },
    ]
  );
}

export async function ensureRuntimePermission({
  current,
  request,
  name,
  purpose,
}: RuntimePermissionOptions) {
  try {
    let permission = current;

    if (!permission?.granted && permission?.canAskAgain !== false) {
      permission = await request();
    }

    if (permission?.granted) return true;

    showPermissionSettingsAlert(name, purpose);
    return false;
  } catch (error) {
    console.warn(`Unable to request ${name.toLowerCase()} permission:`, error);
    showPermissionSettingsAlert(name, purpose);
    return false;
  }
}

export async function ensureHabitCameraPermission() {
  const current = await ImagePicker.getCameraPermissionsAsync();

  return ensureRuntimePermission({
    current,
    request: ImagePicker.requestCameraPermissionsAsync,
    name: 'Camera',
    purpose: 'Camera access is needed to take a photo for your habit proof.',
  });
}
