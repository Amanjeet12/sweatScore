import Purchases from 'react-native-purchases';

type SubscriptionUser = {
  _id?: string;
  isAdmin?: boolean;
};

export async function hasActiveSubscription(
  user: SubscriptionUser | null
) {
  if (!user) return false;
  if (user.isAdmin) return true;

  try {
    if (user._id) {
      await Purchases.logIn(user._id.toString());
    }

    const customerInfo = await Purchases.getCustomerInfo();

    return Boolean(
      customerInfo.entitlements.active['Premium']
    );
  } catch (error) {
    console.warn('[RevenueCat] Subscription check failed', error);
    return false;
  }
}
