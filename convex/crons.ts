import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';
import { legacySchedulerRetired } from './legacySchedulerCutover';

const crons = cronJobs();

crons.interval(
  'Send Client Trigger Notifications',
  { minutes: 5 },
  internal.clientNotifications.processScheduledNotifications,
  {}
);

// Retained legacy registration for rollback review. Only the explicit
// server-side retirement switch removes it from an active deployment.
if (!legacySchedulerRetired())
  crons.interval(
    'Maintain Rolling Daily Check-Ins',
    { minutes: 5 },
    internal.admin.maintainRollingDailyCheckIns
  );

crons.cron(
  'Update Monthly Leaderboard For All Users',
  '0 * 1 * *', // Every hour on the 1st day of the month
  internal.leaderboard.updateMonthlyLeaderboardForAllUsers
);

crons.cron(
  'Upgrade User To Premium',
  '0 * 1 * *', // Every hour on the 1st day of the month
  internal.leaderboard.upgradeUserToPremium
);

export default crons;
