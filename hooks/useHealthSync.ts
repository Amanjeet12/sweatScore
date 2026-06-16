import { useConvex, useMutation } from 'convex/react';
import { useState } from 'react';

import { getHealthDataForDate } from './useHealthData';
import { api } from '../convex/_generated/api';

import { formatDateYYYYMMDD } from '@/utils/timezone';
import { Id } from '~/convex/_generated/dataModel';

export const useHealthSync = (
  userId: Id<'users'>,
  timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone,
  userBirthdate?: number
) => {
  const convex = useConvex();
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncHealthData = useMutation(api.activities.syncHealthData);

  // Calculate user age from birthdate
  const getUserAge = () => {
    if (!userBirthdate) return undefined;

    const birthDate = new Date(userBirthdate);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Function to sync all missed days
  const syncAllMissedDays = async () => {
    setIsSyncing(true);
    setError(null);

    const userAge = getUserAge();
    // Use current time instead of todayInTimezone to avoid double timezone conversion
    const now = new Date();
    const todayHealthData = await getHealthDataForDate(now, timeZone, userAge);

    if (!userId || !todayHealthData.hasPermissions) {
      setIsSyncing(false);
      return;
    }

    const getMissedDays = await convex.query(api.activities.getMissedDaysForSync, {
      userId,
    });

    try {
      // Process missed days in batches to avoid overwhelming the health API
      const missedDays = [...getMissedDays];
      const healthDataBatch = [];

      // Then process previous missed days
      for (const day of missedDays) {
        // Parse the date string from the server
        const missedDate = new Date(day + 'T00:00:00'); // Ensure proper parsing
        // Get health data for that date in the user's timezone
        const healthData = await getHealthDataForDate(missedDate, timeZone, userAge);

        healthDataBatch.push({
          date: day, // Keep the original date string from server
          steps: healthData.steps,
          zone2Minutes: healthData.zone2Minutes,
          stepsTill11am: healthData.stepsTill11am,
        });
      }

      // Add today's data first
      const formattedTodayDate = formatDateYYYYMMDD(now, timeZone);
      healthDataBatch.push({
        date: formattedTodayDate,
        steps: todayHealthData.steps,
        zone2Minutes: todayHealthData.zone2Minutes,
        stepsTill11am: todayHealthData.stepsTill11am,
      });

      // Send batch to server
      if (healthDataBatch.length > 0) {
        await syncHealthData({ userId, healthData: healthDataBatch });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync health data');
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    isSyncing,
    syncAllMissedDays,
    error,
  };
};
