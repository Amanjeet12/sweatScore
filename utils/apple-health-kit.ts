import type { AppleHealthKit as AppleHealthKitModule } from 'react-native-health';

type AppleHealthKitExport = {
  default?: AppleHealthKitModule;
  HealthKit?: AppleHealthKitModule;
} & Partial<AppleHealthKitModule>;

export function getAppleHealthKit(): AppleHealthKitModule | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const healthKitModule = require('react-native-health') as AppleHealthKitExport;
  const candidates = [healthKitModule.default, healthKitModule.HealthKit, healthKitModule];

  const healthKit = candidates.find(
    (candidate) =>
      candidate &&
      typeof candidate.isAvailable === 'function' &&
      typeof candidate.initHealthKit === 'function'
  );

  return healthKit ? (healthKit as AppleHealthKitModule) : null;
}
