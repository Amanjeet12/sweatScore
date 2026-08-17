import { getData } from '~/utils/storage';

export const REVENUECAT_PENDING_REDEMPTION_KEY = 'pending-revenuecat-redemption';

export const hasPendingRevenueCatRedemption = () =>
  typeof getData(REVENUECAT_PENDING_REDEMPTION_KEY) === 'string';
