import type { AppleHealthKit as AppleHealthKitModule } from 'react-native-health';

import { healthPermissions } from '~/utils/constants';

type AppleHealthKitExport = {
  default?: AppleHealthKitModule;
  HealthKit?: AppleHealthKitModule;
} & Partial<AppleHealthKitModule>;

export function getAppleHealthKit(): AppleHealthKitModule | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const healthKitModule = require('react-native-health') as AppleHealthKitExport;
  const candidates = [healthKitModule.HealthKit, healthKitModule.default, healthKitModule];

  const healthKit = candidates.find(
    (candidate) =>
      candidate &&
      typeof candidate.isAvailable === 'function' &&
      typeof candidate.initHealthKit === 'function'
  );

  return healthKit ? (healthKit as AppleHealthKitModule) : null;
}

export async function isAppleHealthAvailable() {
  const AppleHealthKit = getAppleHealthKit();
  if (!AppleHealthKit) return false;

  return new Promise<boolean>((resolve) => {
    AppleHealthKit.isAvailable((err, isAvailable) => {
      if (err) {
        console.warn('Apple Health availability check failed:', err);
        resolve(false);
        return;
      }

      resolve(Boolean(isAvailable));
    });
  });
}

export async function initializeAppleHealthKit() {
  const AppleHealthKit = getAppleHealthKit();
  if (!AppleHealthKit) return false;

  return new Promise<boolean>((resolve) => {
    AppleHealthKit.initHealthKit(healthPermissions, (err) => {
      if (err) {
        console.warn('Apple Health initialization failed:', err);
        resolve(false);
        return;
      }

      resolve(true);
    });
  });
}
