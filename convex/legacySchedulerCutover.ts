// Server-only switch. Leave unset until the development validation, mapping,
// queue inventory and in-flight upload reconciliation gates have passed.
export const legacySchedulerRetired = () => process.env.LEGACY_CHECKIN_SCHEDULER_RETIRED === 'true';

export const isLegacyCheckInPush = (type: string) =>
  type === 'dailyCheckInLive' || type === 'dailyCheckInReminder';

export const shouldSuppressPush = (retired: boolean, type: string) =>
  retired && isLegacyCheckInPush(type);
