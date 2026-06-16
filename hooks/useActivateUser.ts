import { useConvex } from 'convex/react';
import * as Application from 'expo-application';
import * as Localization from 'expo-localization';
import { Platform } from 'react-native';

import { api } from '~/convex/_generated/api';
import { CatchPromise } from '~/utils/catch-promise';
import { formatDateYYYYMMDD } from '~/utils/timezone';

export const useActivateUser = () => {
  const convex = useConvex();

  const activateUser = async () => {
    const today = new Date();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const formattedDate = formatDateYYYYMMDD(today, timezone);

    const userCountry = Localization.getLocales()[0]?.regionCode || 'UK';

    await CatchPromise(
      convex.mutation(api.users.updateLastActiveAt, {
        date: formattedDate,
        timezone,
        countryCode: userCountry,
        platform: Platform.OS,
        appVersion: Application.nativeApplicationVersion ?? '1.0.0',
      })
    );
  };

  return {
    activateUser,
  };
};
