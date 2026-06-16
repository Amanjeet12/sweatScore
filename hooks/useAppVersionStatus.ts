import { compare } from 'compare-versions';
import { useQuery } from 'convex/react';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

import { api } from '~/convex/_generated/api';

export type AppVersionStatus = 'up_to_date' | 'update_available' | 'force_update';

export function useAppVersionStatus(): {
  status: AppVersionStatus;
  latestVersion: string | null;
  storeUrl: string | null;
} {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const config = useQuery(api.appVersionConfig.getForPlatform, { platform });
  const current = Application.nativeApplicationVersion ?? '0.0.0';

  if (!config) {
    return { status: 'up_to_date', latestVersion: null, storeUrl: null };
  }

  if (compare(current, config.minVersion, '<')) {
    return {
      status: 'force_update',
      latestVersion: config.latestVersion,
      storeUrl: config.storeUrl,
    };
  }
  if (compare(current, config.latestVersion, '<')) {
    return {
      status: 'update_available',
      latestVersion: config.latestVersion,
      storeUrl: config.storeUrl,
    };
  }
  return {
    status: 'up_to_date',
    latestVersion: config.latestVersion,
    storeUrl: config.storeUrl,
  };
}
