import Purchases from 'react-native-purchases';

import { REVENUECAT_PENDING_REDEMPTION_KEY } from '~/utils/revenuecatRedemption';
import { storeData } from '~/utils/storage';

export async function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const redemption = await Purchases.parseAsWebPurchaseRedemption(path);

    if (!redemption) {
      return path;
    }

    storeData(REVENUECAT_PENDING_REDEMPTION_KEY, path);

    if (__DEV__) {
      console.log('[RevenueCatRedemption] Redemption URL captured');
    }

    // The root route resolves the existing Convex session. It sends logged-out
    // users through the normal email/OTP flow and does not force authenticated
    // users to sign in again.
    return '/';
  } catch (error) {
    console.error('[RevenueCatRedemption] Native intent parsing failed', error);
    return path;
  }
}
