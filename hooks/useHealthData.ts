import { Platform } from 'react-native';
import type { HealthInputOptions } from 'react-native-health';
import type { TimeRangeFilter } from 'react-native-health-connect/src/types/base.types';

import { getDayRangeISO } from '@/utils/timezone';
import { getAppleHealthKit } from '~/utils/apple-health-kit';
import { healthPermissions } from '~/utils/constants';
import { getData } from '~/utils/storage';

function getHealthConnect() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('react-native-health-connect') as typeof import('react-native-health-connect');
}

// Promisify HealthKit methods for iOS
function promisifyHealthKitMethod<T>(
  method: Function,
  options: any,
  defaultValue: T,
  aggregateFn?: (results: any) => T
): Promise<T> {
  return new Promise<T>((resolve) => {
    method(options, (err: any, results: any) => {
      if (err) return resolve(defaultValue);
      if (aggregateFn) return resolve(aggregateFn(results));
      resolve(results.value ?? defaultValue);
    });
  });
}

// Helper function to calculate Zone 2 minutes from heart rate samples (iOS format)
function calculateZone2Minutes(heartRateSamples: any[], userAge: number): number {
  if (!heartRateSamples || heartRateSamples.length === 0 || !userAge) {
    return 0;
  }

  const maxHR = 220 - userAge;
  const zone2Min = maxHR * 0.6; // 60% of max HR

  // Track unique minutes in Zone 2 or above
  const minutesInZone2 = new Set<string>();

  heartRateSamples.forEach((sample) => {
    if (sample.value >= zone2Min) {
      // Extract the minute from the timestamp
      const sampleDate = new Date(sample.startDate);
      const minuteKey = `${sampleDate.getHours()}:${sampleDate.getMinutes()}`;
      minutesInZone2.add(minuteKey);
    }
  });

  return minutesInZone2.size;
}

// Helper function to calculate Zone 2 minutes from Android heart rate aggregated data
function calculateZone2MinutesAndroid(heartRateAggregatedData: any[], userAge: number): number {
  if (!heartRateAggregatedData || heartRateAggregatedData.length === 0 || !userAge) {
    return 0;
  }

  const maxHR = 220 - userAge;
  const zone2Min = maxHR * 0.6; // 60% of max HR

  // Count minutes where BPM_AVG is >= zone2Min
  const zone2Minutes = heartRateAggregatedData.filter((record) => {
    const avgBPM = record.result?.BPM_AVG;
    return avgBPM && avgBPM >= zone2Min;
  }).length;

  return zone2Minutes;
}

// Helper function to get start of day to 11am range in timezone
function get11amRangeISO(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const dateString = formatter.format(date);
  const [year, month, day] = dateString.split('-').map((num) => parseInt(num, 10));

  // Create start of day (00:00:00)
  const startDate = new Date();
  startDate.setFullYear(year, month - 1, day);
  startDate.setHours(0, 0, 0, 0);

  // Create 11am
  const elevenAM = new Date();
  elevenAM.setFullYear(year, month - 1, day);
  elevenAM.setHours(11, 0, 0, 0);

  return {
    startDate: startDate.toISOString(),
    endDate: elevenAM.toISOString(),
  };
}

// iOS HealthKit data fetch
async function fetchIOSHealthData(date: Date, timeZone: string, userAge?: number) {
  let steps = 0,
    zone2Minutes = 0,
    stepsTill11am = 0,
    hasPermissions = false;

  const AppleHealthKit = getAppleHealthKit();
  if (!AppleHealthKit) return { steps, zone2Minutes, stepsTill11am, hasPermissions };

  // Get timezone-adjusted date range
  const { startDate, endDate } = getDayRangeISO(date, timeZone);
  const elevenAmRange = get11amRangeISO(date, timeZone);

  // Check availability
  const isAvailable = await new Promise<boolean>((resolve) => {
    AppleHealthKit.isAvailable((err, available) => resolve(!err && !!available));
  });
  if (!isAvailable) return { steps, zone2Minutes, hasPermissions };

  // Request permissions
  const permissionsGranted = await new Promise<boolean>((resolve) => {
    AppleHealthKit.initHealthKit(healthPermissions, (err) => resolve(!err));
  });
  if (!permissionsGranted) return { steps, zone2Minutes, hasPermissions };
  hasPermissions = true;

  const options: HealthInputOptions = {
    date: date.toISOString(),
    startDate,
    endDate,
    includeManuallyAdded: false,
  };

  steps = await promisifyHealthKitMethod<number>(AppleHealthKit.getStepCount, options, 0);

  // Get heart rate samples and calculate Zone 2 minutes
  const heartRateSamples = await promisifyHealthKitMethod<any[]>(
    AppleHealthKit.getHeartRateSamples,
    options,
    [],
    (results) => results
  );

  if (userAge) {
    zone2Minutes = calculateZone2Minutes(heartRateSamples, userAge);
  }

  // Fetch data till 11am using getDailyStepCountSamples
  const stepSamplesTill11am = await promisifyHealthKitMethod<any[]>(
    AppleHealthKit.getDailyStepCountSamples,
    {
      startDate: elevenAmRange.startDate,
      endDate: elevenAmRange.endDate,
      includeManuallyAdded: false,
    },
    [],
    (results) => results
  );

  // Sum up the step counts from samples
  stepsTill11am = stepSamplesTill11am.reduce((sum, sample) => sum + (sample.value || 0), 0);

  const autoSyncEnabled = getData('autoSync')?.enabled ?? true;
  if (!autoSyncEnabled)
    return {
      steps: 0,
      zone2Minutes: 0,
      stepsTill11am: 0,
      hasPermissions: false,
    };

  return { steps, zone2Minutes, stepsTill11am, hasPermissions };
}

// Android Health Connect data fetch
async function fetchAndroidHealthData(date: Date, timeZone: string, userAge?: number) {
  const {
    SdkAvailabilityStatus,
    aggregateGroupByDuration,
    aggregateRecord,
    getGrantedPermissions,
    getSdkStatus,
    initialize,
  } = getHealthConnect();

  let steps = 0,
    zone2Minutes = 0,
    stepsTill11am = 0,
    hasPermissions = false;

  // // Check if Health Connect is available
  const sdkStatus = await getSdkStatus();
  if (sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
    return { steps, zone2Minutes, stepsTill11am, hasPermissions }; // SDK not available on this device
  }
  if (sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
    // Optionally redirect to Play Store to update Health Connect
    // Linking.openURL('market://details?id=com.google.android.apps.healthdata');
    return { steps, zone2Minutes, stepsTill11am, hasPermissions };
  }

  // Get timezone-adjusted date range
  const { startDate, endDate } = getDayRangeISO(date, timeZone);
  const elevenAmRange = get11amRangeISO(date, timeZone);

  const isInitialized = await initialize();
  if (!isInitialized) return { steps, zone2Minutes, stepsTill11am, hasPermissions };

  // Use getGrantedPermissions instead of requestPermission to avoid
  // ActivityResultLauncher crash - permissions should be requested during onboarding only
  const grantedPermissions = await getGrantedPermissions();
  hasPermissions = grantedPermissions.length > 0;
  if (!hasPermissions) return { steps, zone2Minutes, stepsTill11am, hasPermissions };

  const timeRangeFilter: TimeRangeFilter = {
    operator: 'between',
    startTime: startDate,
    endTime: endDate,
  };

  // Steps
  // const stepsResult = await readRecords('Steps', { timeRangeFilter });
  // steps = stepsResult.records.reduce((sum, cur) => sum + cur.count, 0);

  const aggregateSteps = await aggregateRecord({
    recordType: 'Steps',
    timeRangeFilter,
  });
  steps = aggregateSteps.COUNT_TOTAL;

  // Get heart rate data and calculate Zone 2 minutes
  try {
    const heartRateResult = await aggregateGroupByDuration({
      recordType: 'HeartRate',
      timeRangeFilter,
      timeRangeSlicer: {
        duration: 'MINUTES',
        length: 1,
      },
    });

    if (userAge && heartRateResult && heartRateResult.length > 0) {
      zone2Minutes = calculateZone2MinutesAndroid(heartRateResult, userAge);
    }
  } catch (error) {
    console.warn('Error fetching heart rate data:', error);
    // Continue without heart rate data
  }

  // Fetch data till 11am
  const timeRangeFilterTill11am: TimeRangeFilter = {
    operator: 'between',
    startTime: elevenAmRange.startDate,
    endTime: elevenAmRange.endDate,
  };

  const aggregateStepsTill11am = await aggregateRecord({
    recordType: 'Steps',
    timeRangeFilter: timeRangeFilterTill11am,
  });
  stepsTill11am = aggregateStepsTill11am.COUNT_TOTAL;

  const autoSyncEnabled = getData('autoSync')?.enabled ?? true;
  if (!autoSyncEnabled)
    return {
      steps: 0,
      zone2Minutes: 0,
      stepsTill11am: 0,
      hasPermissions: false,
    };

  return { steps, zone2Minutes, stepsTill11am, hasPermissions };
}

// Export for server-side or one-off use
export async function getHealthDataForDate(
  date: Date,
  timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone,
  userAge?: number
) {
  if (Platform.OS === 'ios') {
    return fetchIOSHealthData(date, timeZone, userAge);
  } else if (Platform.OS === 'android') {
    return fetchAndroidHealthData(date, timeZone, userAge);
  }
  return {
    steps: 0,
    zone2Minutes: 0,
    stepsTill11am: 0,
    hasPermissions: false,
  };
}
