import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();

// Run every hour to check which users should receive notifications at 9pm their time
crons.hourly(
  'Send Engagement Notifications',
  {
    minuteUTC: 0,
  },
  internal.notifications.processNotifications
);

crons.hourly(
  'Send Daily Mission Notifications',
  {
    minuteUTC: 0,
  },
  internal.notifications.processDailyMissionNotifications
);

// crons.cron(
//   'Send Reward Notifications',
//   '0 * 28 * *', // 28th day of the month
//   internal.notifications.processRewardNotifications
// );

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
